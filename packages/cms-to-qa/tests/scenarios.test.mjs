/**
 * The row set is the spine: the markdown report, the HTML walkthrough and the
 * workbook all render from it, so a wrong status here is a wrong status in three
 * artefacts at once. These tests hold the parts that a reader would otherwise
 * have to take on trust — that a case nobody ran is not counted as a pass, and
 * that a field the run could not touch still appears.
 */
import { describe, expect, it } from 'vitest'
import {
  STATUS,
  buildScenarios,
  caseSteps,
  describeValue,
  expectedResult,
  scenariosForPage,
  pagesNotRun,
  summarise,
  testId,
} from '../src/scenarios.mjs'

const kase = (over = {}) => ({
  id: 'happy',
  kind: 'happy',
  value: 'Hello',
  expect: 'saves',
  why: 'an ordinary value must save',
  ...over,
})

const field = (over = {}) => ({
  name: 'headline',
  type: 'text',
  required: true,
  hidden: false,
  cases: [kase()],
  ...over,
})

const page = (over = {}) => ({
  page: 'Header',
  kind: 'global',
  adminUrl: '/admin/globals/Header',
  section: 'Header',
  fields: [field()],
  ...over,
})

const passing = (fieldName, caseId, log = {}) => ({
  tests: [
    { field: fieldName, caseId, status: 'passed', error: null, video: 'Header/videos/v.webm' },
  ],
  log: [
    {
      event: 'case',
      field: fieldName,
      case: caseId,
      outcome: 'saved',
      status: 200,
      renderedOnPublicPage: true,
      ...log,
    },
  ],
})

describe('describeValue', () => {
  it('names an empty and a whitespace value rather than showing nothing', () => {
    // A blank cell in a scenario sheet reads as "not filled in", which is the one
    // thing this row must not be confused with.
    expect(describeValue('')).toBe('(empty string)')
    expect(describeValue('   ')).toBe('(whitespace only, 3 chars)')
  })

  it('states the length of a long value instead of pasting 5000 characters', () => {
    const out = describeValue('L'.repeat(5000))
    expect(out).toContain('[5000 chars total]')
    expect(out.length).toBeLessThan(140)
  })

  it('counts astral-plane characters as one character each', () => {
    // `.length` would say 2 per emoji and report a 3-character value as 6, which
    // is the exact confusion the unicode case exists to expose.
    expect(describeValue('a👍b')).toBe('a👍b')
    expect(describeValue('👍'.repeat(90))).toContain('[90 chars total]')
  })
})

describe('testId', () => {
  it('is stable, ordered and citable', () => {
    expect(testId('Header', 1)).toBe('TC-HEADER-001')
    expect(testId('SpecificationsCell', 42)).toBe('TC-SPECIFICATIONSCELL-042')
  })
})

describe('caseSteps', () => {
  it('tells a tester to open the first row of a collection, not just the list', () => {
    const steps = caseSteps(
      page({ kind: 'collection', adminUrl: '/admin/collections/FooterLink' }),
      field(),
      kase(),
    )
    expect(steps[1]).toContain('first row')
  })

  it('does not ask for a public-page check on a page that renders no section', () => {
    const steps = caseSteps(page({ section: null }), field(), kase())
    expect(steps.some((s) => s.includes('search the page source'))).toBe(false)
  })

  it('ends a rejected case at the refusal and the unchanged value', () => {
    const steps = caseSteps(page(), field(), kase({ expect: 'rejected' }))
    expect(steps.at(-1)).toContain('still holds the value it had')
    // Nothing about the public page: the value was never meant to get there.
    expect(steps.some((s) => s.includes('open `/`'))).toBe(false)
  })

  it('asks for the devtools check on an injection case', () => {
    const steps = caseSteps(page(), field(), kase({ kind: 'injection' }))
    expect(steps.at(-1)).toContain('img onerror')
  })
})

describe('expectedResult', () => {
  it('requires the refusal and the unchanged document together', () => {
    const out = expectedResult(page(), field(), kase({ expect: 'rejected' }))
    expect(out).toContain('refused')
    expect(out).toContain('unchanged')
  })

  it('requires an exact read-back, so a silent trim is a failure', () => {
    expect(expectedResult(page(), field(), kase())).toContain('no trim, no truncation')
  })

  it('omits the public-page requirement when no section renders the page', () => {
    expect(expectedResult(page({ section: null }), field(), kase())).not.toContain('served for')
  })
})

describe('scenariosForPage', () => {
  it('reads the status from the run rather than deciding one', () => {
    const rows = scenariosForPage(page(), passing('headline', 'happy'))
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe(STATUS.pass)
    expect(rows[0].actual).toContain('HTTP 200')
    expect(rows[0].publicPage).toBe('Found in the HTML served for /')
    expect(rows[0].evidence).toBe('Header/videos/v.webm')
  })

  it('keys results per field, so one field cannot borrow another field result', () => {
    // Every field has a `happy` case. Keyed on the case id alone, `subhead`
    // would inherit `headline`'s pass and the sheet would report a failure
    // against the wrong field.
    const p = page({ fields: [field(), field({ name: 'subhead' })] })
    const rows = scenariosForPage(p, passing('headline', 'happy'))
    expect(rows.find((r) => r.field === 'headline').status).toBe(STATUS.pass)
    expect(rows.find((r) => r.field === 'subhead').status).toBe(STATUS.notExecuted)
  })

  it('marks an abandoned case NOT RUN, never passed', () => {
    // Playwright reports a case abandoned after an earlier failure in the same
    // serial group as `skipped`. Folding that into "passed" is the failure mode
    // the whole three-bucket tally exists to prevent.
    const rows = scenariosForPage(page(), {
      tests: [{ field: 'headline', caseId: 'happy', status: 'skipped', error: null }],
      log: [],
    })
    expect(rows[0].status).toBe(STATUS.notRun)
    expect(rows[0].actual).toContain('never ran')
  })

  it('gives a hidden field a row that says nothing was checked', () => {
    const rows = scenariosForPage(page({ fields: [field({ hidden: true })] }), null)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe(STATUS.notExecuted)
    expect(rows[0].expected).toContain('admin.hidden')
  })

  it('gives a field with no case template a row too, and says which type', () => {
    const rows = scenariosForPage(page({ fields: [field({ type: 'upload', cases: [] })] }), null)
    expect(rows[0].status).toBe(STATUS.notExecuted)
    expect(rows[0].expected).toContain('`upload`')
  })

  it('reports a failure with the run own message rather than a generic one', () => {
    const rows = scenariosForPage(page(), {
      tests: [
        {
          field: 'headline',
          caseId: 'happy',
          status: 'failed',
          error: 'Expected value "x"\n  at line 3',
        },
      ],
      log: [],
    })
    expect(rows[0].status).toBe(STATUS.fail)
    expect(rows[0].actual).toContain('Expected value "x"')
    // First line only: a 200-line Playwright stack in a spreadsheet cell is a
    // cell nobody reads.
    expect(rows[0].actual).not.toContain('at line 3')
  })

  it('does not claim a public-page result for a case expected to be refused', () => {
    const p = page({ fields: [field({ cases: [kase({ id: 'empty', expect: 'rejected' })] })] })
    const rows = scenariosForPage(p, {
      tests: [{ field: 'headline', caseId: 'empty', status: 'passed', error: null }],
      log: [
        {
          event: 'case',
          field: 'headline',
          case: 'empty',
          outcome: 'rejected-as-required',
          status: 400,
        },
      ],
    })
    expect(rows[0].publicPage).toContain('n/a')
    expect(rows[0].actual).toContain('unchanged')
  })

  it('names the field that saved but never reached the page', () => {
    const rows = scenariosForPage(
      page(),
      passing('headline', 'happy', { renderedOnPublicPage: false }),
    )
    expect(rows[0].publicPage.startsWith('NOT found')).toBe(true)
    // Still a pass: the case asserted persistence, and the missing render is a
    // finding the report surfaces separately rather than a failed assertion.
    expect(rows[0].status).toBe(STATUS.pass)
  })

  it('says a blank value was not checked rather than not found', () => {
    const rows = scenariosForPage(
      page(),
      passing('headline', 'happy', { renderedOnPublicPage: null }),
    )
    expect(rows[0].publicPage).toContain('Not checked')
  })
})

describe('buildScenarios and summarise', () => {
  const inventory = {
    pages: [page(), page({ page: 'Footer', fields: [field({ name: 'copyright' })] })],
  }

  it('covers only the pages this run targeted, and names the rest', () => {
    // The first version emitted a row for every field of every discovered page.
    // A single-page run then produced 377 rows of which 363 were other pages'
    // matrices marked NOT EXECUTED, and the one real result drowned in them.
    const resultsByPage = new Map([['Header', passing('headline', 'happy')]])
    const rows = buildScenarios(inventory, resultsByPage)
    expect(rows.map((r) => r.page)).toEqual(['Header'])
    expect(pagesNotRun(inventory, resultsByPage)).toEqual(['Footer'])
  })

  it('keeps rows for a targeted page whose report is missing, marked not executed', () => {
    // Targeted but unobserved is a different fact from never targeted, and the
    // sheet has to be able to say the first one.
    const rows = buildScenarios(inventory, new Map([['Header', null]]))
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe(STATUS.notExecuted)
  })

  it('numbers test IDs per page, so a page can be run alone and cited', () => {
    const rows = buildScenarios(
      inventory,
      new Map([
        ['Header', null],
        ['Footer', null],
      ]),
    )
    expect(rows.map((r) => r.id)).toEqual(['TC-HEADER-001', 'TC-FOOTER-001'])
  })

  it('totals add up to the row count, so no row is silently uncounted', () => {
    const rows = buildScenarios(inventory, new Map([['Header', passing('headline', 'happy')]]))
    const s = summarise(rows)
    expect(s.pass + s.fail + s.notRun + s.notExecuted).toBe(s.total)
    expect(s.total).toBe(rows.length)
  })
})
