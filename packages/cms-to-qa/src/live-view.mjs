/**
 * The run as a frame a human watches while it happens.
 *
 * `report.html` answers "show me" after the fact; this answers "what is it
 * doing" during the thirty minutes of `--all`. The two are not the same artefact
 * and this one is explicitly **not** evidence: every figure the pack publishes is
 * read from Playwright's JSON report by `scenarios.mjs`, and nothing here feeds
 * that. What this module renders is a progress display, which is why it is
 * allowed to be approximate mid-page and why its numbers are replaced by the
 * report's own at each page boundary.
 *
 * Two rules keep it honest anyway:
 *
 * - **A pass is only ever counted from the suite's own case log.** `cases.jsonl`
 *   is appended by the spec on the paths that succeeded, so a case shown as
 *   passing is one the browser recorded. Nothing here upgrades a case to a pass
 *   because a line looked green.
 * - **A finished case with no log entry is shown as not passing, never as a
 *   pass.** That is the only inference in the module, and it fails toward the
 *   pessimistic side: a case that ended without recording success either failed
 *   or errored.
 *
 * Pure by design — no stdout, no timers, no `Date.now()`. The caller passes
 * `now` and `tick`, so a frame is a function of its arguments and a test can
 * assert on the exact string.
 */

/** Visible width of a string, ignoring the SGR escapes that occupy no columns. */
export const visibleWidth = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '').length

/** Truncates to `width` visible columns, keeping escapes intact. */
export function clip(s, width) {
  if (visibleWidth(s) <= width) return s
  let out = ''
  let seen = 0
  for (const part of String(s).split(/(\x1b\[[0-9;]*m)/)) {
    if (part.startsWith('\x1b')) {
      out += part
      continue
    }
    for (const ch of part) {
      if (seen >= width - 1) return `${out}…\x1b[0m`
      out += ch
      seen += 1
    }
  }
  return out
}

/** Pads to `width` visible columns. Never truncates — use `clip` for that. */
export const pad = (s, width) => s + ' '.repeat(Math.max(0, width - visibleWidth(s)))
export const padStart = (s, width) => ' '.repeat(Math.max(0, width - visibleWidth(s))) + s

const SGR = {
  reset: 0,
  bold: 1,
  dim: 2,
  italic: 3,
}

/**
 * A 256-colour palette rather than truecolour: every terminal that renders the
 * box-drawing characters this frame is built from also has 256 colours, and the
 * fallback for a terminal that does not is `colour: false`, not a second palette.
 */
const INK = {
  accent: 44, // teal — the run's own chrome
  accentDim: 30,
  pass: 78, // green
  fail: 203, // red
  warn: 214, // amber
  run: 45, // cyan
  text: 252,
  muted: 244,
  faint: 240,
  rule: 238,
}

/** Builds the colour functions, or identity functions when colour is off. */
export function palette(colour = true) {
  const wrap = (open, close = SGR.reset) =>
    colour ? (s) => `\x1b[${open}m${s}\x1b[${close}m` : (s) => String(s)
  const fg = (n) => wrap(`38;5;${n}`)
  return {
    accent: fg(INK.accent),
    accentDim: fg(INK.accentDim),
    pass: fg(INK.pass),
    fail: fg(INK.fail),
    warn: fg(INK.warn),
    run: fg(INK.run),
    text: fg(INK.text),
    muted: fg(INK.muted),
    faint: fg(INK.faint),
    rule: fg(INK.rule),
    bold: wrap(SGR.bold, 22),
    dim: wrap(SGR.dim, 22),
    italic: wrap(SGR.italic, 23),
    // Reversed accent for the one badge that carries the run's identity.
    brand: colour ? (s) => `\x1b[1;38;5;${INK.accent}m${s}\x1b[0m` : (s) => String(s),
  }
}

export const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const PAGE_STATUS = {
  queued: 'queued',
  running: 'running',
  pass: 'pass',
  fail: 'fail',
}

/** `4m 12s`, or `12.4s` under a minute — a duration a human reads at a glance. */
export function humanDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${String(Math.floor(s - m * 60)).padStart(2, '0')}s`
}

/**
 * A bar with eighth-of-a-cell resolution.
 *
 * Whole blocks plus one partial, so a single case out of 377 moves the bar
 * rather than rounding away — the reason a coarse bar reads as a hung run.
 */
export function bar(done, total, width) {
  // Nine entries, not eight: the partial cell rounds to a whole one at 8/8, and
  // an eight-entry table indexes past its end there and splices the string
  // "undefined" into the bar.
  const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']
  if (width <= 0) return ''
  if (total <= 0) return '░'.repeat(width)
  const ratio = Math.max(0, Math.min(1, done / total))
  const cells = ratio * width
  const full = Math.floor(cells)
  const part = Math.round((cells - full) * 8)
  // A started-but-not-finished bar never renders as empty, and a finished one
  // never renders as short: both would misreport the state they are drawn for.
  const head = full >= width ? '█'.repeat(width) : '█'.repeat(full) + EIGHTHS[part]
  return pad(head, width).replaceAll(' ', '░')
}

/** Cases the inventory generated for a page — the denominator, from the config. */
const casesInPage = (pageInfo) =>
  (pageInfo?.fields ?? []).reduce((n, f) => n + (f.cases?.length ?? 0), 0)

/**
 * @param {object} o
 * @param {string} o.runId
 * @param {string[]} o.pages   the pages this invocation targets, in run order
 * @param {object} o.inventory
 * @param {number} o.now
 */
export function createRunState({ runId, pages, inventory, now }) {
  const byName = new Map(inventory.pages.map((p) => [p.page, p]))
  return {
    runId,
    startedAt: now,
    discovered: inventory.pages.length,
    pages: pages.map((page) => ({
      page,
      total: casesInPage(byName.get(page)),
      // `finished` counts cases the runner has ended; `passed` counts only those
      // the suite recorded. They differ by the cases that did not pass.
      finished: 0,
      passed: 0,
      gaps: 0,
      fail: 0,
      notRun: 0,
      status: PAGE_STATUS.queued,
      field: null,
      case: null,
      note: null,
      failure: null,
      startedAt: null,
      endedAt: null,
    })),
  }
}

const find = (state, page) => state.pages.find((p) => p.page === page)

export function beginPage(state, page, now) {
  const p = find(state, page)
  if (p) {
    p.status = PAGE_STATUS.running
    p.startedAt = now
  }
  return state
}

/**
 * Folds one line of the suite's own `cases.jsonl` into the frame's state.
 *
 * `baseline` opens a field, `case` closes one case, `restore` closes the field.
 * Only `case` moves a counter, and only ever upward.
 */
export function applyEvent(state, page, ev) {
  const p = find(state, page)
  if (!p || !ev) return state
  if (ev.event === 'baseline') {
    p.field = ev.field ?? p.field
    p.case = null
    p.note = null
    return state
  }
  if (ev.event === 'case') {
    p.passed += 1
    p.finished = Math.max(p.finished, p.passed)
    p.field = ev.field ?? p.field
    p.case = ev.case ?? null
    // `renderedOnPublicPage` is tri-state: `false` is the bug this suite exists
    // to find, `null` only means the case could not be checked against the page.
    if (ev.renderedOnPublicPage === false) p.gaps += 1
    p.note =
      ev.outcome === 'rejected-as-required'
        ? `refused ${ev.status} · as required`
        : ev.renderedOnPublicPage === false
          ? `saved ${ev.status} · NOT on the page`
          : ev.renderedOnPublicPage === true
            ? `saved ${ev.status} · on the page`
            : `saved ${ev.status}`
    return state
  }
  return state
}

/**
 * A case ended, from the runner's own progress output.
 *
 * Deliberately not a verdict. This advances the denominator's counterpart so a
 * failing case does not read as a stall, and it can never mark a case passed —
 * only `applyEvent` does that, from the log the spec writes.
 */
export function noteCaseFinished(state, page) {
  const p = find(state, page)
  if (p) p.finished = Math.min(p.total, p.finished + 1)
  return state
}

/** Replaces the page's live approximation with the figures from its own report. */
export function endPage(state, page, { exit, tally, failure, now }) {
  const p = find(state, page)
  if (!p) return state
  p.endedAt = now
  p.failure = failure ?? null
  if (tally) {
    p.passed = tally.pass
    p.fail = tally.fail
    p.notRun = tally.notRun
    p.gaps = tally.gaps ?? p.gaps
    p.finished = tally.pass + tally.fail
  }
  p.status = (tally ? tally.fail > 0 : true) || exit !== 0 ? PAGE_STATUS.fail : PAGE_STATUS.pass
  p.field = null
  p.case = null
  p.note = null
  return state
}

/** Run-wide counters, summed from the pages. */
export function totals(state) {
  const t = {
    pages: state.pages.length,
    pagesDone: 0,
    cases: 0,
    finished: 0,
    passed: 0,
    fail: 0,
    notRun: 0,
    gaps: 0,
  }
  for (const p of state.pages) {
    if (p.status === PAGE_STATUS.pass || p.status === PAGE_STATUS.fail) t.pagesDone += 1
    t.cases += p.total
    t.finished += p.finished
    t.passed += p.passed
    t.fail += p.fail
    t.notRun += p.notRun
    t.gaps += p.gaps
  }
  return t
}

const MARK = {
  [PAGE_STATUS.pass]: '✔',
  [PAGE_STATUS.fail]: '✖',
  [PAGE_STATUS.queued]: '·',
}

function pageRow(p, { c, tick, nameWidth, barWidth, now }) {
  const running = p.status === PAGE_STATUS.running
  const ink =
    p.status === PAGE_STATUS.pass
      ? c.pass
      : p.status === PAGE_STATUS.fail
        ? c.fail
        : running
          ? c.run
          : c.faint
  const mark = running ? SPINNER[tick % SPINNER.length] : MARK[p.status]
  const track = p.status === PAGE_STATUS.queued ? c.faint('░'.repeat(barWidth)) : null
  const graph = track ?? ink(bar(p.finished, p.total, barWidth))
  const count =
    p.status === PAGE_STATUS.queued
      ? c.faint(padStart('—', 7))
      : c.text(padStart(`${p.finished}/${p.total}`, 7))

  let tail
  if (p.status === PAGE_STATUS.queued) tail = c.faint('queued')
  else if (running) {
    const behind = p.finished - p.passed
    tail = c.run(humanDuration(now - p.startedAt))
    if (behind > 0) tail += c.fail(`  ${behind} not passing`)
    if (p.gaps > 0) tail += c.warn(`  ⚠ ${p.gaps}`)
  } else {
    const bits = []
    if (p.fail > 0) bits.push(c.fail(`${p.fail} fail`))
    if (p.notRun > 0) bits.push(c.warn(`${p.notRun} never ran`))
    if (p.gaps > 0) bits.push(c.warn(`⚠ ${p.gaps} not on page`))
    if (bits.length === 0) bits.push(c.pass('all pass'))
    bits.push(c.faint(humanDuration(p.endedAt - p.startedAt)))
    tail = bits.join(c.faint(' · '))
  }

  return `  ${ink(mark)} ${pad(c.text(p.page), nameWidth)} ${graph} ${count}   ${tail}`
}

/** The `field / case` detail line under a page that has one worth showing. */
function detailRow(p, { c }) {
  if (p.failure) {
    const where = p.field && p.case ? `${p.field} / ${p.case}   ` : ''
    return `      ${c.fail(where)}${c.muted(clip(p.failure.split('\n')[0], 200))}`
  }
  if (!p.field) return null
  const where = p.case ? `${p.field} / ${p.case}` : p.field
  return `      ${c.accentDim(where)}${p.note ? c.faint('   ' + p.note) : ''}`
}

/**
 * The whole frame as one string.
 *
 * Clamped to `rows` so the caller can redraw it in place: a frame taller than
 * the terminal cannot be rewound with cursor moves, and the result is the
 * cascade of half-frames that makes a live view worse than plain lines. When the
 * page list does not fit, finished pages collapse into one line — the run's
 * verdict is in the footer and in the report either way.
 *
 * @param {object} state
 * @param {object} o
 * @param {number} o.width   terminal columns
 * @param {number} o.rows    terminal rows available to the frame
 * @param {number} o.now
 * @param {number} o.tick    spinner frame counter
 * @param {boolean} o.colour
 */
export function renderFrame(state, { width = 100, rows = 40, now, tick = 0, colour = true } = {}) {
  const c = palette(colour)
  const w = Math.max(60, Math.min(width, 120))
  const inner = w - 2
  const t = totals(state)

  const spin = t.pagesDone < t.pages ? SPINNER[tick % SPINNER.length] : '●'
  const head = [
    c.rule(`╭${'─'.repeat(inner)}╮`),
    `${c.rule('│')} ${pad(
      `${c.brand('CMS FIELD MATRIX')}  ${c.faint('run')} ${c.muted(state.runId)}`,
      inner - 2 - visibleWidth(`${spin} ${humanDuration(now - state.startedAt)}`),
    )}${c.accent(spin)} ${c.text(humanDuration(now - state.startedAt))} ${c.rule('│')}`,
    c.rule(`╰${'─'.repeat(inner)}╯`),
    '',
  ]

  const barWidth = Math.max(12, Math.floor(inner * 0.34))
  const pct = t.cases > 0 ? Math.floor((t.finished / t.cases) * 100) : 0
  const overall = [
    `  ${c.faint('pages')} ${c.accent(bar(t.pagesDone, t.pages, barWidth))} ` +
      `${c.text(`${t.pagesDone}/${t.pages}`)}${c.faint(
        state.discovered > t.pages ? ` of ${state.discovered} discovered` : '',
      )}`,
    `  ${c.faint('cases')} ${c.accent(bar(t.finished, t.cases, barWidth))} ` +
      `${c.text(`${t.finished}/${t.cases}`)}  ${c.bold(c.accent(`${pct}%`))}`,
    '',
  ]

  const footRule = `  ${c.rule('─'.repeat(inner - 2))}`
  const tallies = [
    t.passed > 0 ? c.pass(`${t.passed} pass`) : null,
    t.fail > 0 ? c.fail(`${t.fail} fail`) : null,
    t.notRun > 0 ? c.warn(`${t.notRun} never ran`) : null,
    t.gaps > 0
      ? c.warn(c.bold(`${t.gaps} saved but NOT on the page`))
      : c.faint('0 saved-but-not-rendered'),
  ].filter(Boolean)
  const active = state.pages.find((p) => p.status === PAGE_STATUS.running)
  const foot = [
    footRule,
    `  ${tallies.join(c.faint('   '))}`,
    active
      ? `  ${c.run(SPINNER[tick % SPINNER.length])} ${c.muted(
          `${active.page}${active.field ? `.${active.field}` : ''}${active.case ? ` / ${active.case}` : ''}`,
        )}`
      : `  ${c.faint('no page running')}`,
  ]

  // What is left for the page list, once the fixed chrome has its rows. No floor
  // on this: a floor is what silently breaks the height guarantee the caller's
  // cursor arithmetic depends on, so a frame with no room for the list renders
  // without the list rather than overflowing.
  const budget = Math.max(0, rows - head.length - overall.length - foot.length - 1)
  const nameWidth = Math.max(...state.pages.map((p) => p.page.length), 4)

  const rowsFor = (p) => {
    const out = [pageRow(p, { c, tick, nameWidth, barWidth, now })]
    const detail = detailRow(p, { c })
    if (detail) out.push(detail)
    return out
  }

  let list = state.pages.flatMap(rowsFor)
  if (list.length > budget) {
    // Keep the tail: the running page and what is queued behind it is the part
    // that changes. Finished pages are collapsed into their counts.
    const done = state.pages.filter(
      (p) => p.status === PAGE_STATUS.pass || p.status === PAGE_STATUS.fail,
    )
    const rest = state.pages.filter((p) => !done.includes(p))
    const failed = done.filter((p) => p.status === PAGE_STATUS.fail)
    const collapsed = done.length
      ? [
          `  ${c.faint('┈')} ${c.muted(`${done.length} page(s) finished`)}${
            failed.length
              ? c.fail(`   ${failed.length} failed: ${failed.map((p) => p.page).join(', ')}`)
              : c.pass('   all passed')
          }`,
        ]
      : []
    list = [...collapsed, ...rest.flatMap(rowsFor)]
    // Still too tall with everything collapsed: drop the queued tail, which is
    // the only part a reader can reconstruct without being told.
    while (list.length > budget) list.pop()
  }

  const frame = [...head, ...overall, ...list, '', ...foot]
  // The footer carries the verdict, so when even the chrome does not fit it is
  // the head that goes. The final slice is a backstop that must never be the
  // thing doing the work — if it ever fires, the arithmetic above is wrong.
  while (frame.length > rows && frame.length > foot.length) frame.shift()
  return frame
    .slice(0, rows)
    .map((line) => clip(line, w))
    .join('\n')
}
