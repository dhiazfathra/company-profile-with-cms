/**
 * The two rendered artefacts.
 *
 * The workbook is checked by reading it back with the same library that wrote it.
 * That is not circular for the thing it is guarding: the risk with a binary
 * format is a file that opens but is wrong — a value in the wrong column, a
 * status nobody coloured, a hyperlink to a path that does not exist. Reading it
 * back catches all three. What it cannot prove is that Excel itself accepts the
 * file, and no test here can; that is why `writeWorkbook` uses a library rather
 * than hand-rolled XML.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { STATUS, buildScenarios } from '../src/scenarios.mjs'
import { esc, renderReport } from '../src/report-html.mjs'
import { AUTHORED_OPTIONS, MEASURED_KEYS, coverageGaps, writeWorkbook } from '../src/workbook.mjs'

const INVENTORY = {
  locales: ['en'],
  versions: [],
  roleFields: [],
  uploads: [{ collection: 'media', mimeTypes: null, filesize: null }],
  pages: [
    {
      page: 'Header',
      kind: 'global',
      adminUrl: '/admin/globals/Header',
      section: 'Header',
      fields: [
        {
          name: 'headline',
          type: 'text',
          required: true,
          hidden: false,
          cases: [
            { id: 'happy', kind: 'happy', value: 'Hello', expect: 'saves', why: 'it must save' },
            {
              id: 'special',
              kind: 'boundary',
              // The values a naive writer of either format breaks on.
              value: `Tom & "Jerry" <b>'x'</b>`,
              expect: 'saves',
              why: 'punctuation must round-trip',
            },
            { id: 'empty', kind: 'boundary', value: '', expect: 'rejected', why: 'it is required' },
          ],
        },
        { name: '_seedIndex', type: 'number', required: false, hidden: true, cases: [] },
        { name: 'image', type: 'upload', required: false, hidden: false, cases: [] },
      ],
    },
    {
      page: 'Footer',
      kind: 'global',
      adminUrl: '/admin/globals/Footer',
      section: 'Footer',
      fields: [{ name: 'copyright', type: 'text', required: false, hidden: false, cases: [] }],
    },
  ],
}

const RESULT = {
  tests: [
    {
      field: 'headline',
      caseId: 'happy',
      status: 'passed',
      error: null,
      video: 'Header/videos/headline--happy.webm',
    },
    {
      field: 'headline',
      caseId: 'special',
      status: 'failed',
      error: '<script>boom</script> & "quoted"',
      video: 'Header/videos/headline--special.webm',
    },
    { field: 'headline', caseId: 'empty', status: 'skipped', error: null, video: null },
  ],
  log: [
    {
      event: 'case',
      field: 'headline',
      case: 'happy',
      outcome: 'saved',
      status: 200,
      renderedOnPublicPage: false,
    },
  ],
}

const resultsByPage = new Map([['Header', RESULT]])
const exitByPage = new Map([['Header', 1]])
const rows = buildScenarios(INVENTORY, resultsByPage)

describe('esc', () => {
  it('escapes every character that could close a tag or an attribute', () => {
    expect(esc(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;'")
  })

  it('escapes the ampersand first, so an escape is not double-escaped', () => {
    // `&lt;` arriving in the output as `&amp;lt;` would be a report that shows
    // its own markup instead of the value.
    expect(esc('&lt;')).toBe('&amp;lt;')
  })
})

describe('renderReport', () => {
  const html = renderReport({
    css: '<style>/* css */</style>',
    runId: '2026-08-23T00-00-00-000Z',
    inventory: INVENTORY,
    resultsByPage,
    exitByPage,
    rows,
    reproduce: 'bun run cms:e2e Header',
  })

  it('embeds a player for every case that produced a recording', () => {
    expect(html).toContain('src="Header/videos/headline--happy.webm"')
    expect(html).toContain('src="Header/videos/headline--special.webm"')
    // Three cases, two recordings: the abandoned case has none and must not get
    // an empty player that looks like a broken one.
    expect(html.match(/<video /g)).toHaveLength(2)
  })

  it('never emits raw markup from a value or an error message', () => {
    // The injection case's own value would otherwise execute in the report that
    // reports on it.
    expect(html).not.toContain('<script>boom</script>')
    expect(html).toContain('&lt;script&gt;boom&lt;/script&gt;')
  })

  it('carries the failure, the abandoned case and the not-executable fields', () => {
    expect(html).toContain(STATUS.fail)
    expect(html).toContain(STATUS.notRun)
    expect(html).toContain(STATUS.notExecuted)
    expect(html).toContain('_seedIndex')
    expect(html).toContain('image')
  })

  it('names the field that saved without reaching the public page', () => {
    // The bug class the whole suite exists for: it gets its own section, not a
    // footnote inside a passing row.
    const section = html.slice(html.indexOf('Saved, but not observed'))
    expect(section).toContain('headline')
    expect(section).not.toContain('None in this run')
  })

  it('keeps the coverage-gap section', () => {
    expect(html).toContain('Pages not run by this invocation')
    expect(html).toContain('What this run does not cover')
    expect(html).toContain('verify:design')
    // Read from the inventory rather than asserted as fact.
    expect(html).toContain('mimeTypes: none')
  })

  it('includes the stylesheet it was handed rather than importing one', () => {
    expect(html).toContain('<style>/* css */</style>')
  })
})

describe('coverageGaps', () => {
  it('states the locale situation from the config, not from a guess', () => {
    expect(coverageGaps(INVENTORY).join('\n')).toContain('only en is configured')
    expect(coverageGaps({ ...INVENTORY, locales: ['en', 'id'] }).join('\n')).toContain(
      'en, id are configured',
    )
  })

  it('reports enabled versions rather than claiming there are none', () => {
    expect(coverageGaps({ ...INVENTORY, versions: ['Header'] }).join('\n')).toContain(
      'versions are enabled on Header',
    )
  })
})

describe('writeWorkbook', () => {
  let dir
  let book

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'cms-to-qa-'))
    const file = join(dir, 'test-scenarios.xlsx')
    await writeWorkbook(file, {
      runId: '2026-08-23T00-00-00-000Z',
      reproduce: 'bun run cms:e2e Header',
      inventory: INVENTORY,
      rows,
      ranPages: 1,
    })
    book = new ExcelJS.Workbook()
    await book.xlsx.readFile(file)
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('is a workbook that reads back, with the four sheets a tester expects', () => {
    expect(book.worksheets.map((w) => w.name)).toEqual([
      'Summary',
      'Test Scenarios',
      'Traceability',
      'Not Covered',
    ])
  })

  it('round-trips the punctuation that breaks a hand-rolled writer', () => {
    const sheet = book.getWorksheet('Test Scenarios')
    const header = sheet.getRow(1).values.map((v) => v ?? '')
    const dataCol = header.indexOf('Test data')
    const values = []
    sheet.eachRow((row, n) => n > 1 && values.push(row.getCell(dataCol).value))
    expect(values).toContain(`Tom & "Jerry" <b>'x'</b>`)
  })

  it('writes one row per scenario and no more', () => {
    // Off-by-one here is a sheet whose totals disagree with the HTML report's.
    expect(book.getWorksheet('Test Scenarios').rowCount).toBe(rows.length + 1)
  })

  it('states a status for every row, and never invents a pass', () => {
    const sheet = book.getWorksheet('Test Scenarios')
    const header = sheet.getRow(1).values.map((v) => v ?? '')
    const col = header.indexOf('Status')
    const seen = []
    sheet.eachRow((row, n) => n > 1 && seen.push(row.getCell(col).value))
    expect(seen).toEqual([
      STATUS.pass,
      STATUS.fail,
      STATUS.notRun,
      STATUS.notExecuted,
      STATUS.notExecuted,
    ])
  })

  it('links the recording as a relative path, so the bundle can be moved', () => {
    const sheet = book.getWorksheet('Test Scenarios')
    const header = sheet.getRow(1).values.map((v) => v ?? '')
    const cell = sheet.getRow(2).getCell(header.indexOf('Evidence (video)'))
    expect(cell.value.hyperlink).toBe('Header/videos/headline--happy.webm')
    expect(cell.value.hyperlink.startsWith('/')).toBe(false)
  })

  it('marks a field nothing executed as NOT covered, with the reason', () => {
    const sheet = book.getWorksheet('Traceability')
    const header = sheet.getRow(1).values.map((v) => v ?? '')
    const rowsOut = []
    sheet.eachRow((row, n) => {
      if (n === 1) return
      rowsOut.push({
        field: row.getCell(header.indexOf('Field')).value,
        covered: row.getCell(header.indexOf('Covered?')).value,
        why: String(row.getCell(header.indexOf('Why not')).value ?? ''),
      })
    })
    expect(rowsOut.find((r) => r.field === '_seedIndex')).toMatchObject({ covered: 'NO' })
    expect(rowsOut.find((r) => r.field === '_seedIndex').why).toContain('admin.hidden')
    expect(rowsOut.find((r) => r.field === 'image').why).toContain('upload')
    // A field with a failure among its cases is PARTIAL, not YES: a green
    // "covered" against a field that failed is the lie this column exists to
    // avoid.
    expect(rowsOut.find((r) => r.field === 'headline').covered).toBe('PARTIAL')
  })

  it('restates the gaps on their own sheet, where a filter cannot hide them', () => {
    const sheet = book.getWorksheet('Not Covered')
    const text = []
    sheet.eachRow((row) => text.push(row.values.join(' ')))
    const all = text.join('\n')
    expect(all).toContain('Concurrent editors')
    expect(all).toContain('Header.headline')
    expect(all).toContain('Saved but not rendered')
    // The page nobody ran is named here, and distinguished from a field that
    // could not be executed at all.
    expect(all).toContain('Page not run')
    expect(all).toContain('Footer')
  })

  it('records the verdict as FAIL when a case failed', () => {
    const sheet = book.getWorksheet('Summary')
    const pairs = new Map()
    sheet.eachRow((row) => pairs.set(String(row.getCell(1).value), String(row.getCell(2).value)))
    expect(pairs.get('Verdict')).toBe('FAIL')
    expect(pairs.get('Saved but not found in the HTML served for /')).toBe('1')
  })
})

/**
 * Colour and dropdowns.
 *
 * The invariant worth a test is not "is it pretty" — no test here can judge
 * that. It is the boundary between what the run measured and what a tester
 * asserts: a picker on an observed column would let a sheet be edited into
 * agreement with an opinion, and nothing downstream could tell that had
 * happened. So the measured columns must have no validation, the authored
 * columns must have one, and the colour must be derived from the same field the
 * figures are counted from.
 */
describe('workbook colour and dropdowns', () => {
  let dir
  let book

  const header = (sheet) => sheet.getRow(1).values.map((v) => v ?? '')
  const cellsUnder = (sheet, name) => {
    const col = header(sheet).indexOf(name)
    const out = []
    sheet.eachRow((row, n) => n > 1 && out.push(row.getCell(col)))
    return out
  }

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'cms-to-qa-colour-'))
    const file = join(dir, 'test-scenarios.xlsx')
    await writeWorkbook(file, {
      runId: '2026-08-23T00-00-00-000Z',
      reproduce: 'bun run cms:e2e Header',
      inventory: INVENTORY,
      rows,
      ranPages: 1,
    })
    book = new ExcelJS.Workbook()
    await book.xlsx.readFile(file)
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('offers a dropdown on every column a tester authors', () => {
    const scenarios = book.getWorksheet('Test Scenarios')
    for (const [name, options] of [
      ['Tester verdict', AUTHORED_OPTIONS.verdict],
      ['Severity', AUTHORED_OPTIONS.severity],
    ]) {
      const cells = cellsUnder(scenarios, name)
      expect(cells.length, name).toBe(rows.length)
      for (const cell of cells) {
        expect(cell.dataValidation?.type, name).toBe('list')
        // The options a tester sees are the exported list, so the sheet and the
        // module cannot offer different vocabularies.
        expect(cell.dataValidation.formulae[0]).toBe(`"${options.join(',')}"`)
      }
    }
  })

  it('offers a disposition dropdown on every gap, so no gap is left unanswered', () => {
    const cells = cellsUnder(book.getWorksheet('Not Covered'), 'Disposition')
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      expect(cell.dataValidation?.type).toBe('list')
      expect(cell.dataValidation.formulae[0]).toBe(`"${AUTHORED_OPTIONS.disposition.join(',')}"`)
    }
  })

  it('leaves the authored columns empty, so nothing is signed on the run’s behalf', () => {
    const scenarios = book.getWorksheet('Test Scenarios')
    for (const name of ['Tester verdict', 'Severity', 'Tester notes']) {
      for (const cell of cellsUnder(scenarios, name)) {
        expect(cell.value ?? '', name).toBe('')
      }
    }
  })

  it('never puts a dropdown on a column the run measured', () => {
    // The whole point of the split. A picker here turns evidence into an opinion
    // that reads identically to a measurement.
    const scenarios = book.getWorksheet('Test Scenarios')
    const headers = {
      status: 'Status',
      publicPage: 'Public page',
      actual: 'Actual result',
      evidence: 'Evidence (video)',
    }
    for (const key of MEASURED_KEYS) {
      // A key with no header here was silently skipped before, and `cellsUnder`
      // returns nothing for a header that has been renamed — so this test could
      // pass having asserted on no cells at all.
      const header = headers[key]
      expect(header, `no header mapped for measured key ${key}`).toBeTruthy()
      const cells = cellsUnder(scenarios, header)
      expect(cells.length, `no cells found under ${header}`).toBeGreaterThan(0)
      for (const cell of cells) {
        expect(cell.dataValidation, header).toBeUndefined()
      }
    }
    const covered = cellsUnder(book.getWorksheet('Traceability'), 'Covered?')
    expect(covered.length, 'no cells found under Covered?').toBeGreaterThan(0)
    for (const cell of covered) {
      expect(cell.dataValidation).toBeUndefined()
    }
  })

  it('fills a status cell with the colour for that status, and never leaves one bare', () => {
    for (const cell of cellsUnder(book.getWorksheet('Test Scenarios'), 'Status')) {
      expect(cell.fill?.type, String(cell.value)).toBe('pattern')
      expect(cell.font?.bold).toBe(true)
    }
  })

  it('colours the saved-but-not-rendered cell like the failure it is', () => {
    // The gap and its colour are read from the same field `summarise` counts, so
    // a red cell and the Summary figure cannot disagree.
    const gapCells = cellsUnder(book.getWorksheet('Test Scenarios'), 'Public page').filter((c) =>
      String(c.value ?? '').startsWith('NOT found'),
    )
    expect(gapCells.length).toBeGreaterThan(0)
    for (const cell of gapCells) {
      expect(cell.fill?.fgColor?.argb).toBe('FFF9DEDC')
      expect(cell.font?.bold).toBe(true)
    }
  })

  it('colours the Covered? verdict on the traceability sheet', () => {
    const cells = cellsUnder(book.getWorksheet('Traceability'), 'Covered?')
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      expect(['YES', 'PARTIAL', 'NO']).toContain(cell.value)
      expect(cell.fill?.type, String(cell.value)).toBe('pattern')
    }
  })

  it('colours the summary verdict cell, which is the one somebody screenshots', () => {
    const summary = book.getWorksheet('Summary')
    let verdict
    summary.eachRow((row) => {
      if (row.getCell(1).value === 'Verdict') verdict = row.getCell(2)
    })
    expect(verdict).toBeDefined()
    expect(verdict.value).toBe('FAIL')
    expect(verdict.fill?.fgColor?.argb).toBe('FFF9DEDC')
  })

  it('keeps the header frozen and the Test ID column pinned for the signing scroll', () => {
    // A tester scrolling right to the verdict columns otherwise loses the row.
    expect(book.getWorksheet('Test Scenarios').views[0]).toMatchObject({
      state: 'frozen',
      xSplit: 1,
      ySplit: 1,
    })
  })

  it('still round-trips the punctuation and the long value with the styling applied', () => {
    // Styling every cell is a lot more XML per row; the values must survive it.
    const sheet = book.getWorksheet('Test Scenarios')
    const values = cellsUnder(sheet, 'Test data').map((c) => c.value)
    expect(values).toContain(`Tom & "Jerry" <b>'x'</b>`)
  })
})
