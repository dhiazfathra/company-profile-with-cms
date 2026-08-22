import { describe, expect, it } from 'vitest'
import {
  PAGE_STATUS,
  applyEvent,
  bar,
  beginPage,
  clip,
  createRunState,
  endPage,
  humanDuration,
  noteCaseFinished,
  padStart,
  renderFrame,
  totals,
  visibleWidth,
} from '../src/live-view.mjs'

/**
 * What these tests are for.
 *
 * No test here can prove the frame *looks* right — that is eyeballed, and it is
 * listed as a blind spot in the skill for the same reason the workbook's tests
 * cannot prove Excel opens the file. What they can prove is the part that would
 * lie: that a case is never shown as passing unless the suite recorded it, that
 * a gap is counted only when the run said `false` rather than `null`, and that
 * the frame never grows past the rows it was told it may use — because a frame
 * taller than the terminal cannot be redrawn in place and shreds the display.
 */

const INVENTORY = {
  pages: [
    {
      page: 'Header',
      fields: [
        { name: 'headline', cases: [{ id: 'happy' }, { id: 'empty' }, { id: 'long' }] },
        { name: 'imageAlt', cases: [{ id: 'happy' }, { id: 'empty' }] },
      ],
    },
    { page: 'Footer', fields: [{ name: 'note', cases: [{ id: 'happy' }, { id: 'special' }] }] },
    { page: 'Unrelated', fields: [{ name: 'x', cases: [{ id: 'happy' }] }] },
  ],
}

const state = (pages = ['Header', 'Footer']) =>
  createRunState({ runId: 'RUN-1', pages, inventory: INVENTORY, now: 1000 })

const plain = (s, opts = {}) =>
  renderFrame(s, { width: 100, rows: 40, now: 5000, tick: 0, colour: false, ...opts })

describe('createRunState', () => {
  it('takes each page total from the inventory, not from what runs', () => {
    const s = state()
    expect(s.pages.map((p) => [p.page, p.total])).toEqual([
      ['Header', 5],
      ['Footer', 2],
    ])
  })

  it('records how many pages exist beyond the ones targeted', () => {
    // The frame says "of 3 discovered" so a single-page run cannot read as the
    // whole CMS — the same reason the report names the pages it did not run.
    expect(state(['Header']).discovered).toBe(3)
  })

  it('starts every page queued, with nothing counted', () => {
    for (const p of state().pages) {
      expect(p.status).toBe(PAGE_STATUS.queued)
      expect([p.finished, p.passed, p.fail, p.gaps, p.notRun]).toEqual([0, 0, 0, 0, 0])
    }
  })
})

describe('applyEvent', () => {
  it('counts a pass only from a recorded case event', () => {
    const s = beginPage(state(), 'Header', 2000)
    applyEvent(s, 'Header', { event: 'baseline', field: 'headline', original: 'x' })
    expect(s.pages[0].passed).toBe(0)
    applyEvent(s, 'Header', { event: 'case', field: 'headline', case: 'happy', status: 200 })
    expect(s.pages[0].passed).toBe(1)
  })

  it('counts a gap on renderedOnPublicPage false and not on null', () => {
    const s = beginPage(state(), 'Header', 2000)
    applyEvent(s, 'Header', {
      event: 'case',
      field: 'headline',
      case: 'happy',
      status: 200,
      renderedOnPublicPage: null,
    })
    expect(s.pages[0].gaps).toBe(0)
    applyEvent(s, 'Header', {
      event: 'case',
      field: 'headline',
      case: 'empty',
      status: 200,
      renderedOnPublicPage: false,
    })
    expect(s.pages[0].gaps).toBe(1)
  })

  it('names the gap in the note, in words a reader cannot misread as a pass', () => {
    const s = beginPage(state(), 'Header', 2000)
    applyEvent(s, 'Header', {
      event: 'case',
      field: 'headline',
      case: 'happy',
      status: 200,
      renderedOnPublicPage: false,
    })
    expect(s.pages[0].note).toContain('NOT on the page')
  })

  it('reports a required refusal as a refusal, not as a failure', () => {
    const s = beginPage(state(), 'Footer', 2000)
    applyEvent(s, 'Footer', {
      event: 'case',
      field: 'note',
      case: 'format-bad',
      outcome: 'rejected-as-required',
      status: 422,
    })
    expect(s.pages[1].note).toBe('refused 422 · as required')
    expect(s.pages[1].passed).toBe(1)
  })

  it('ignores an event for a page this run is not tracking', () => {
    const s = state(['Header'])
    applyEvent(s, 'Footer', { event: 'case', field: 'note', case: 'happy' })
    expect(totals(s).passed).toBe(0)
  })

  it('ignores a null event rather than throwing on a half-written log line', () => {
    // The runner tails a file the suite is appending to; a partial line parses
    // to nothing and must not take the display down with it.
    const s = beginPage(state(), 'Header', 2000)
    expect(() => applyEvent(s, 'Header', null)).not.toThrow()
    expect(s.pages[0].passed).toBe(0)
  })
})

describe('noteCaseFinished', () => {
  it('advances the finished count without ever claiming a pass', () => {
    const s = beginPage(state(), 'Header', 2000)
    noteCaseFinished(s, 'Header')
    expect(s.pages[0].finished).toBe(1)
    expect(s.pages[0].passed).toBe(0)
  })

  it('shows a finished-but-unrecorded case as not passing', () => {
    const s = beginPage(state(), 'Header', 2000)
    applyEvent(s, 'Header', { event: 'case', field: 'headline', case: 'happy', status: 200 })
    noteCaseFinished(s, 'Header')
    noteCaseFinished(s, 'Header')
    // 3 ended, 1 recorded success: the display must say two are not passing
    // rather than round them into the pass column.
    expect(plain(s, { now: 3000 })).toContain('2 not passing')
  })

  it('never counts past the total the inventory generated', () => {
    const s = beginPage(state(), 'Footer', 2000)
    for (let i = 0; i < 10; i += 1) noteCaseFinished(s, 'Footer')
    expect(s.pages[1].finished).toBe(2)
  })
})

describe('endPage', () => {
  it("replaces the live approximation with the page's own figures", () => {
    const s = beginPage(state(), 'Header', 2000)
    applyEvent(s, 'Header', { event: 'case', field: 'headline', case: 'happy', status: 200 })
    endPage(s, 'Header', {
      exit: 1,
      tally: { pass: 2, fail: 1, notRun: 2, gaps: 0 },
      now: 9000,
    })
    const p = s.pages[0]
    expect([p.passed, p.fail, p.notRun, p.status]).toEqual([2, 1, 2, PAGE_STATUS.fail])
  })

  it('fails a page whose runner exited non-zero even with no failed case', () => {
    // A crash before any case ran exits non-zero with an empty tally. Calling
    // that a pass is exactly the green-check-for-a-claim-nobody-made failure.
    const s = beginPage(state(), 'Header', 2000)
    endPage(s, 'Header', { exit: 1, tally: { pass: 0, fail: 0, notRun: 5, gaps: 0 }, now: 9000 })
    expect(s.pages[0].status).toBe(PAGE_STATUS.fail)
  })

  it('fails a page that produced no report at all', () => {
    const s = beginPage(state(), 'Header', 2000)
    endPage(s, 'Header', { exit: -1, tally: null, failure: 'no report', now: 9000 })
    expect(s.pages[0].status).toBe(PAGE_STATUS.fail)
  })

  it('passes a page with no failure and a zero exit', () => {
    const s = beginPage(state(), 'Footer', 2000)
    endPage(s, 'Footer', { exit: 0, tally: { pass: 2, fail: 0, notRun: 0, gaps: 0 }, now: 9000 })
    expect(s.pages[1].status).toBe(PAGE_STATUS.pass)
  })

  it('clears the running detail so a finished page shows no live case', () => {
    const s = beginPage(state(), 'Header', 2000)
    applyEvent(s, 'Header', { event: 'baseline', field: 'headline' })
    endPage(s, 'Header', { exit: 0, tally: { pass: 5, fail: 0, notRun: 0, gaps: 0 }, now: 9000 })
    expect(s.pages[0].field).toBeNull()
  })
})

describe('bar', () => {
  it('is empty at zero and full at total', () => {
    expect(bar(0, 10, 4)).toBe('░░░░')
    expect(bar(10, 10, 4)).toBe('████')
  })

  it('moves for a single case out of many, rather than rounding it away', () => {
    // A 30-cell bar at 1/377 rounds to zero whole cells; without the partial
    // block the run reads as hung for its first minutes.
    expect(bar(1, 377, 30)).not.toBe('░'.repeat(30))
  })

  it('never renders a finished bar as short or an over-count as wider', () => {
    expect(visibleWidth(bar(11, 10, 6))).toBe(6)
    expect(bar(11, 10, 6)).toBe('██████')
  })

  it('renders a full track when nothing is known yet', () => {
    expect(bar(0, 0, 3)).toBe('░░░')
  })

  it('never splices "undefined" into the bar when the partial cell rounds up', () => {
    // 30/32 across 33 cells lands the partial at 8/8. Caught on a real run, as
    // literal text in the middle of a page's bar.
    expect(bar(30, 32, 33)).not.toContain('undefined')
    // Every ratio at every plausible width, since one off-by-one is the bug.
    for (let width = 1; width <= 40; width += 1) {
      for (let done = 0; done <= 40; done += 1) {
        const drawn = bar(done, 40, width)
        expect(drawn).not.toContain('undefined')
        expect(visibleWidth(drawn), `${done}/40 at ${width}`).toBe(width)
      }
    }
  })
})

describe('humanDuration', () => {
  it('uses tenths under a minute and zero-padded seconds above', () => {
    expect(humanDuration(12_400)).toBe('12.4s')
    expect(humanDuration(252_000)).toBe('4m 12s')
    expect(humanDuration(305_000)).toBe('5m 05s')
  })

  it('renders an unknown duration as a dash rather than NaN', () => {
    expect(humanDuration(NaN)).toBe('—')
    expect(humanDuration(undefined)).toBe('—')
  })
})

describe('width helpers', () => {
  it('measures visible width without counting colour escapes', () => {
    expect(visibleWidth('\x1b[38;5;44mabc\x1b[0m')).toBe(3)
  })

  it('clips to the visible budget and keeps the escapes balanced', () => {
    const clipped = clip('\x1b[38;5;44m' + 'x'.repeat(50) + '\x1b[0m', 10)
    expect(visibleWidth(clipped)).toBeLessThanOrEqual(10)
    expect(clipped.endsWith('\x1b[0m')).toBe(true)
  })

  it('leaves a string already within the budget untouched', () => {
    expect(clip('short', 40)).toBe('short')
  })

  it('right-aligns a count without counting escapes as characters', () => {
    expect(visibleWidth(padStart('\x1b[38;5;44m5/7\x1b[0m', 7))).toBe(7)
  })
})

describe('renderFrame', () => {
  it('emits no escape sequences when colour is off', () => {
    expect(plain(state())).not.toMatch(/\x1b\[/)
  })

  it('emits colour when colour is on', () => {
    expect(renderFrame(state(), { now: 5000, colour: true })).toMatch(/\x1b\[38;5;/)
  })

  it('never exceeds the rows it was given, at any page count', () => {
    // The whole reason the frame is clamped: the caller rewinds the cursor by
    // exactly this many rows to redraw, and one row too many cascades.
    const many = createRunState({
      runId: 'R',
      pages: INVENTORY.pages.map((p) => p.page),
      inventory: INVENTORY,
      now: 0,
    })
    for (const rows of [8, 12, 20, 40]) {
      const lines = plain(many, { rows }).split('\n')
      expect(lines.length, `rows=${rows}`).toBeLessThanOrEqual(rows)
    }
  })

  it('never exceeds the width it was given, on any line', () => {
    const s = beginPage(state(), 'Header', 2000)
    applyEvent(s, 'Header', {
      event: 'case',
      field: 'headline',
      case: 'happy',
      status: 200,
      renderedOnPublicPage: false,
    })
    for (const line of plain(s, { width: 72 }).split('\n')) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(72)
    }
  })

  it('collapses finished pages when the list cannot fit, naming the failures', () => {
    const s = createRunState({
      runId: 'R',
      pages: ['Header', 'Footer', 'Unrelated'],
      inventory: INVENTORY,
      now: 0,
    })
    endPage(s, 'Header', { exit: 1, tally: { pass: 4, fail: 1, notRun: 0, gaps: 0 }, now: 10 })
    endPage(s, 'Footer', { exit: 0, tally: { pass: 2, fail: 0, notRun: 0, gaps: 0 }, now: 20 })
    const out = plain(s, { rows: 12, now: 30 })
    expect(out).toContain('2 page(s) finished')
    expect(out).toContain('Header')
  })

  it('reports the gap count in the footer, in words, when there is one', () => {
    const s = beginPage(state(), 'Header', 2000)
    applyEvent(s, 'Header', {
      event: 'case',
      field: 'headline',
      case: 'happy',
      status: 200,
      renderedOnPublicPage: false,
    })
    expect(plain(s, { now: 3000 })).toContain('1 saved but NOT on the page')
  })

  it('says zero gaps explicitly rather than omitting the line', () => {
    // An absent counter reads as "not checked". The suite's whole point is that
    // this check ran, so the frame says so even when the answer is zero.
    expect(plain(state())).toContain('0 saved-but-not-rendered')
  })

  it("shows a failed page's first error line under its row", () => {
    const s = beginPage(state(), 'Header', 2000)
    endPage(s, 'Header', {
      exit: 1,
      tally: { pass: 0, fail: 1, notRun: 4, gaps: 0 },
      failure: 'read ECONNRESET\n  at somewhere deep',
      now: 9000,
    })
    const out = plain(s, { now: 9000 })
    expect(out).toContain('read ECONNRESET')
    expect(out).not.toContain('at somewhere deep')
  })

  it('names the running page and case in the footer', () => {
    const s = beginPage(state(), 'Header', 2000)
    applyEvent(s, 'Header', { event: 'case', field: 'headline', case: 'long', status: 200 })
    expect(plain(s, { now: 3000 })).toContain('Header.headline / long')
  })

  it('says no page is running before the first one starts', () => {
    expect(plain(state())).toContain('no page running')
  })

  it('names the discovered total when the run targets a subset', () => {
    expect(plain(state(['Header']))).toContain('of 3 discovered')
  })

  it('omits the discovered note when every page is targeted', () => {
    const all = createRunState({
      runId: 'R',
      pages: INVENTORY.pages.map((p) => p.page),
      inventory: INVENTORY,
      now: 0,
    })
    expect(plain(all)).not.toContain('discovered')
  })

  it('is a pure function of its arguments', () => {
    const s = state()
    expect(plain(s)).toBe(plain(s))
  })
})

describe('totals', () => {
  it('sums the pages rather than tracking a second copy of the counts', () => {
    const s = state()
    beginPage(s, 'Header', 2000)
    endPage(s, 'Header', { exit: 1, tally: { pass: 3, fail: 1, notRun: 1, gaps: 2 }, now: 5000 })
    beginPage(s, 'Footer', 5000)
    applyEvent(s, 'Footer', { event: 'case', field: 'note', case: 'happy', status: 200 })
    const t = totals(s)
    expect(t).toMatchObject({ pages: 2, pagesDone: 1, cases: 7, passed: 4, fail: 1, gaps: 2 })
  })
})
