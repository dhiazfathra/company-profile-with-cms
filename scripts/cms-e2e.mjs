#!/usr/bin/env bun
/**
 * Runs the CMS field matrix for one page — or for every page — and writes the
 * evidence bundle the pull request quotes.
 *
 *   bun scripts/cms-e2e.mjs Header          # one page
 *   bun scripts/cms-e2e.mjs --all           # every discovered page, sequentially
 *   bun scripts/cms-e2e.mjs --discover-only # inventory and matrices, no browser
 *
 * Two rules this script exists to enforce, both of them lessons from the
 * evidence pack in AGENTS.md:
 *
 *   Every number in a report is read from Playwright's JSON report and from the
 *   run's own case log, never from terminal output. A summary line is written for
 *   a human — its spacing and its stream both change — and a script that parses
 *   one reports a formatting change as a missing result.
 *
 *   A page whose run failed still gets its report, and the report says so. The
 *   rollup counts failures and exits non-zero. What it must never do is omit a
 *   page: a bundle with nine reports out of ten looks complete.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildScenarios, renderReport, summarise, writeWorkbook } from 'cms-to-qa'
import { REPORT_CSS } from './report-style.mjs'

const WEB = path.resolve(import.meta.dir, '../apps/web')
const ARG = process.argv.slice(2)
const ALL = ARG.includes('--all')
const DISCOVER_ONLY = ARG.includes('--discover-only')
const NAMED = ARG.filter((a) => !a.startsWith('--'))

// Directory name a reviewer can order and a second run cannot overwrite.
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-')
const ROOT = path.join(WEB, 'test-evidence', RUN_ID)

/**
 * Playwright's test process does not read `apps/web/.env` — `webServer.env` is
 * the server's environment, not the runner's — so the credentials the spec needs
 * to sign in have to be handed to it here. Without this the whole matrix fails
 * on the login step with nothing to say about any field.
 */
function dotenv() {
  const file = path.join(WEB, '.env')
  if (!existsSync(file)) return {}
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const at = line.indexOf('=')
        // `export FOO=…` is a line developers write, and keeping the prefix in
        // the key produces a variable the spec never reads — surfacing as a
        // login failure that says nothing about `.env`. Quotes are stripped only
        // as a matched pair: the old independent strip turned `"secret` into
        // `secret` and ate a trailing apostrophe from a value that wanted one.
        const key = line
          .slice(0, at)
          .replace(/^export\s+/, '')
          .trim()
        const raw = line.slice(at + 1).trim()
        return [key, /^(["']).*\1$/s.test(raw) ? raw.slice(1, -1) : raw]
      }),
  )
}

const ENV_FILE = dotenv()

const run = (cmd, args, env = {}) =>
  spawnSync(cmd, args, {
    cwd: WEB,
    stdio: 'inherit',
    // The real environment wins over the file: CI sets these as secrets and
    // must not be overridden by whatever a developer left in .env.
    env: { ...ENV_FILE, ...process.env, ...env },
  })

console.log(`\n▸ discovering the CMS from apps/web/payload.config.ts`)
const discovery = run('bun', ['scripts/cms-discover-cli.ts', ROOT])
if (discovery.status !== 0) {
  throw new Error('discovery failed — no inventory, so no matrix. See the output above.')
}

const inventoryPath = path.join(ROOT, 'inventory.json')
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'))
const known = inventory.pages.map((p) => p.page)

const pages = ALL ? known : NAMED
if (!DISCOVER_ONLY && pages.length === 0) {
  throw new Error(
    `Name a page, or pass --all. Discovered pages:\n  ${known.join('\n  ')}\n` +
      `Matrices for all of them are in ${path.relative(WEB, ROOT)}/<page>/field-matrix.md`,
  )
}
for (const page of pages) {
  if (!known.includes(page)) {
    throw new Error(`"${page}" is not a page in this CMS. Discovered: ${known.join(', ')}`)
  }
}

/**
 * Reads the run's own record: Playwright's JSON report plus the case log.
 *
 * The suite path is carried down, not just the test title. The spec nests a
 * describe per field inside one per page, and a case id repeats across fields —
 * every field has a `happy`. Keyed on the title alone, `Header.headline`'s result
 * would be indistinguishable from `Header.subhead`'s, and the QA sheet would
 * attribute one field's failure to another.
 */
function collect(dir) {
  const reportPath = path.join(dir, 'logs', 'results.json')
  if (!existsSync(reportPath)) return null
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  const tests = []
  const walk = (suite, trail) => {
    const here = suite.title ? [...trail, suite.title] : trail
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const result = t.results?.[t.results.length - 1]
        const attachments = result?.attachments ?? []
        tests.push({
          title: spec.title,
          // The innermost describe is the field name; the case id is the leading
          // token of the test title, which the spec builds as
          // `${kase.id} (${kase.kind}) — ${kase.why}`.
          field: here[here.length - 1] ?? null,
          caseId: spec.title.split(' ')[0],
          status: result?.status ?? 'unknown',
          expected: t.expectedStatus,
          error: result?.error?.message ?? null,
          attachments: attachments.map((a) => a.name),
          videoSource: attachments.find((a) => a.name === 'video')?.path ?? null,
        })
      }
    }
    for (const child of suite.suites ?? []) walk(child, here)
  }
  // The outermost suite's title is the spec's file path rather than a describe.
  // It joins the trail like any other, which is harmless: only the innermost
  // entry is ever read, and that is the field.
  for (const suite of report.suites ?? []) walk(suite, [])

  const logPath = path.join(dir, 'logs', 'cases.jsonl')
  const log = existsSync(logPath)
    ? readFileSync(logPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : []
  return { tests, log, errors: report.errors ?? [] }
}

const strip = (s) => String(s).replace(/\[[0-9;]*m/g, '')

/**
 * Three buckets, because two would lie. Playwright reports a case abandoned
 * after an earlier failure in the same serial group as `skipped`, and folding
 * those into either "passed" or "failed" misstates what the run observed.
 */
function tally(collected) {
  const notRun = collected.tests.filter((t) => t.status === 'skipped')
  const failed = collected.tests.filter(
    (t) => !['expected', 'passed', 'skipped'].includes(t.status),
  )
  return { failed, notRun, passed: collected.tests.length - failed.length - notRun.length }
}

function pageReport(page, dir, collected, exitCode) {
  const info = inventory.pages.find((p) => p.page === page)
  const lines = [`# CMS field matrix run — ${page}`, '', `Run: \`${RUN_ID}\``, '']

  if (!collected) {
    lines.push(
      '## Result: NO REPORT',
      '',
      'Playwright wrote no JSON report for this page, so this run observed nothing about it.',
      `The runner exited ${exitCode}. Treat this page as untested; the raw output is in \`logs/run.log\`.`,
      '',
    )
    return lines.join('\n')
  }

  const { failed, passed, notRun } = tally(collected)
  lines.push(
    `## Result: ${failed.length === 0 && exitCode === 0 ? 'PASS' : 'FAIL'}`,
    '',
    `| Figure | Value | Read from |`,
    `| --- | --- | --- |`,
    `| Fields with a completed case | ${new Set(collected.log.filter((l) => l.event === 'case').map((l) => l.field)).size} of ${info.fields.length} discovered | \`logs/cases.jsonl\` |`,
    `| Cases in the matrix | ${collected.tests.length} | \`logs/results.json\` |`,
    `| Cases passed | ${passed} | \`logs/results.json\` |`,
    `| Cases failed | ${failed.length} | \`logs/results.json\` |`,
    `| Cases that never ran | ${notRun.length} | \`logs/results.json\` |`,
    `| Runner exit code | ${exitCode} | \`playwright test\` |`,
    '',
    `Reproduce: \`bun scripts/cms-e2e.mjs ${page}\``,
    '',
  )

  // A field's cases run serially, so the first failure abandons the rest of that
  // field. Counting those as failures inflates the damage; counting them as
  // passes hides it. They are neither, and the report says which they are.
  if (notRun.length) {
    lines.push(
      '## Cases that never ran',
      '',
      'A failure abandons the remaining cases for that field, because each one starts from the value the last left behind.',
      '',
      ...notRun.map((t) => `- ${t.title}`),
      '',
    )
  }

  if (failed.length) {
    lines.push('## Failures', '')
    for (const t of failed) {
      lines.push(
        `### ${t.title}`,
        '',
        '```',
        strip(t.error ?? '(no error message recorded)').slice(0, 1500),
        '```',
        t.attachments.length ? `Artefacts: ${t.attachments.join(', ')} (in \`traces/\`)` : '',
        '',
      )
    }
  }

  // The persistence half a green suite does not prove. A field that saves but
  // never appears in the served HTML is either not rendered by any component or
  // is rendered from something other than the CMS; the run cannot tell which, so
  // it names them instead of counting them as covered.
  // Per case, not per field: `special` can be absent from the HTML while the
  // same field's `happy` is right there in it, and collapsing the two to a field
  // name turns a specific finding into a vague one.
  const notRendered = collected.log
    .filter((l) => l.event === 'case' && l.renderedOnPublicPage === false)
    .map((l) => `${l.field} / ${l.case}`)
  const noRenderCheck = collected.log
    .filter((l) => l.event === 'case' && l.renderedOnPublicPage === null)
    .map((l) => `${l.field} / ${l.case}`)
  lines.push(
    '## Saved, but not observed on the public page',
    '',
    notRendered.length
      ? notRendered
          .map(
            (f) =>
              `- \`${f}\` — saved and re-read from the database, but the value was not in the HTML served for \`/\`, raw or escaped. Either no component renders that field, or it is rendered from something other than the CMS. This run cannot tell which.`,
          )
          .join('\n')
      : '- none',
    '',
    '## Fields with no public-page check',
    '',
    noRenderCheck.length
      ? noRenderCheck
          .map(
            (f) =>
              `- \`${f}\` — the case's value was empty or whitespace, so there is nothing to look for in the HTML.`,
          )
          .join('\n')
      : '- none',
    '',
    // Two different facts, and the first version of this report printed the
    // first explanation for both. `record()` runs after the assertions, so a
    // failing case logs nothing — a field whose first case failed produced zero
    // `case` lines and was reported as having no case template, which is the
    // opposite of what the run observed. The case count comes from the inventory
    // (written by cms-discover-cli.ts), so the two are distinguishable.
    '## Fields with no case template',
    '',
    (() => {
      const none = info.fields.filter((f) => !f.cases?.length)
      return none.length
        ? none
            .map(
              (f) =>
                `- \`${f.name}\` (${f.type}) — no case template exists for this field type, so nothing about it was checked.`,
            )
            .join('\n')
        : '- none'
    })(),
    '',
    '## Fields hidden from the admin form',
    '',
    (() => {
      const hidden = info.fields.filter((f) => f.hidden)
      return hidden.length
        ? hidden
            .map(
              (f) =>
                `- \`${f.name}\` (${f.type}) — \`admin.hidden\` is set, so the panel renders no input and this suite cannot drive it through the form. Not covered.`,
            )
            .join('\n')
        : '- none'
    })(),
    '',
    '## Fields with a template that logged no case',
    '',
    (() => {
      const logged = new Set(collected.log.filter((l) => l.event === 'case').map((l) => l.field))
      const silent = info.fields.filter((f) => f.cases?.length && !f.hidden && !logged.has(f.name))
      return silent.length
        ? silent
            .map(
              (f) =>
                `- \`${f.name}\` (${f.type}) — ${f.cases.length} cases were generated and none completed. Its first case failed, or the run stopped before reaching it. See the failures above.`,
            )
            .join('\n')
        : '- none'
    })(),
    '',
    '## What this run does not cover',
    '',
    `- **Draft vs published.** ${inventory.versions.length ? `Versions are enabled on: ${inventory.versions.join(', ')}.` : 'No global or collection in this config enables `versions`, so draft and published states do not exist to test.'}`,
    `- **Per-role field permissions.** ${inventory.roleFields.length ? `Role fields found: ${inventory.roleFields.join(', ')}.` : 'The auth collection has no role or select field, so there are no role-restricted fields to test.'}`,
    `- **Multi-locale.** Locales configured: ${inventory.locales.join(', ')}. ${inventory.locales.length > 1 ? 'Only the default locale is exercised.' : 'With one locale, a localized field has one value and localization cannot be shown to work.'}`,
    '- **Concurrent editors.** One browser context, one session. Two admins saving the same field at once is not exercised.',
    '- **Unsaved-changes warnings.** Every case saves; navigating away with a dirty form is not exercised.',
    // Read from the inventory rather than stated. This line used to assert as
    // fact that `media` configures no limits — a claim nothing in the run
    // checked, and one that would have survived somebody adding one.
    `- **Uploads.** The upload fields select existing media rather than posting a file, so no limit is exercised. Configured limits: ${
      inventory.uploads?.length
        ? inventory.uploads
            .map(
              (u) =>
                `\`${u.collection}\` (mimeTypes: ${u.mimeTypes ? u.mimeTypes.join(', ') : 'none'}, filesize: ${u.filesize ?? 'none'})`,
            )
            .join('; ')
        : 'no upload collection in this config'
    }.`,
    '- **Layout.** A value that saves and renders can still break the design. `bun run verify:design` is the check for that, and it is not run here.',
    '',
    '## Field matrix',
    '',
    'See `field-matrix.md` beside this file — the full case list for every field, generated from the config, including the cases this run did not get to if it failed early.',
    '',
  )
  return lines.join('\n')
}

/**
 * Playwright names a video after a hash of the test, inside a directory named
 * after the test, and both are unreadable. A tester opening `videos/` should see
 * the field and the case; the workbook links to these paths and the HTML report
 * embeds them, so they have to be stable and relative to the bundle root.
 *
 * Moved rather than copied: the same recording in two places doubles a directory
 * that is already the largest thing in the pack.
 */
function normaliseVideos(page, dir, collected) {
  if (!collected) return
  const out = path.join(dir, 'videos')
  mkdirSync(out, { recursive: true })
  for (const t of collected.tests) {
    t.video = null
    if (!t.videoSource || !existsSync(t.videoSource)) continue
    const safe = (s) => String(s ?? 'unknown').replace(/[^A-Za-z0-9._-]+/g, '-')
    const name = `${safe(t.field)}--${safe(t.caseId)}${path.extname(t.videoSource) || '.webm'}`
    renameSync(t.videoSource, path.join(out, name))
    // Relative to the run root, where report.html and the workbook both sit.
    t.video = `${page}/videos/${name}`
  }
}

const results = []
for (const page of DISCOVER_ONLY ? [] : pages) {
  const dir = path.join(ROOT, page)
  mkdirSync(path.join(dir, 'logs'), { recursive: true })
  mkdirSync(path.join(dir, 'traces'), { recursive: true })
  console.log(`\n▸ ${page}: running the field matrix`)
  const proc = run('bunx', ['playwright', 'test', '--project=cms-fields', '--reporter=list,json'], {
    CMS_E2E_PAGE: page,
    CMS_E2E_EVIDENCE: dir,
    CMS_E2E_INVENTORY: inventoryPath,
    // Playwright's JSON reporter writes to stdout unless told otherwise, and
    // stdout is exactly what must not be the source of the figures.
    PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(dir, 'logs', 'results.json'),
  })
  const collected = collect(dir)
  normaliseVideos(page, dir, collected)
  writeFileSync(path.join(dir, 'report.md'), pageReport(page, dir, collected, proc.status ?? -1))
  results.push({ page, exit: proc.status ?? -1, collected })
}

const rollupLines = [
  '# CMS field matrix — run rollup',
  '',
  `Run: \`${RUN_ID}\`  •  Inventory: \`inventory.json\` (${inventory.pages.length} pages, ${inventory.pages.reduce((n, p) => n + p.fields.length, 0)} fields)`,
  '',
  '| Page | Result | Cases | Passed | Failed | Never ran | Report |',
  '| --- | --- | --- | --- | --- | --- | --- |',
]
for (const r of results) {
  if (!r.collected) {
    rollupLines.push(`| ${r.page} | NO REPORT | — | — | — | — | \`${r.page}/report.md\` |`)
    continue
  }
  const { failed, passed, notRun } = tally(r.collected)
  const verdict = failed.length === 0 && r.exit === 0 ? 'PASS' : 'FAIL'
  rollupLines.push(
    `| ${r.page} | ${verdict} | ${r.collected.tests.length} | ${passed} | ${failed.length} | ${notRun.length} | \`${r.page}/report.md\` |`,
  )
}
const untouched = known.filter((p) => !results.some((r) => r.page === p))
rollupLines.push(
  '',
  '## Pages not run',
  '',
  untouched.length
    ? untouched
        .map((p) => `- ${p} — matrix generated at \`${p}/field-matrix.md\`, no cases executed.`)
        .join('\n')
    : '- none',
  '',
)
writeFileSync(path.join(ROOT, 'rollup.md'), rollupLines.join('\n'))

/**
 * The three artefacts a manual tester signs SIT off with, all rendered from one
 * row set (`cms-to-qa`) so they cannot disagree about the same run:
 *
 *   report.html          the matrix with each case's recording embedded
 *   test-scenarios.xlsx  the scenario sheet, filterable and signable
 *   <page>/videos/       the recordings themselves
 *
 * Written for a single-page run too, not only for `--all`. A tester handed the
 * bundle for the one page a change touched needs the same thing in the same
 * shape, and an artefact that only exists on the long run is one nobody has read
 * by the time it matters.
 */
const resultsByPage = new Map(results.map((r) => [r.page, r.collected]))
const exitByPage = new Map(results.map((r) => [r.page, r.exit]))
const reproduce =
  `# from the repository root\n` +
  `bun run cms:e2e ${ALL ? '--all' : pages.join(' ')}\n` +
  `# prerequisites: apps/web/.env with E2E_USER_EMAIL and E2E_USER_PASSWORD,\n` +
  `# a seeded database (bun run --cwd apps/web seed), and chromium\n` +
  `bunx playwright install chromium`
const rows = buildScenarios(inventory, resultsByPage)

writeFileSync(
  path.join(ROOT, 'report.html'),
  renderReport({
    css: REPORT_CSS,
    runId: RUN_ID,
    inventory,
    resultsByPage,
    exitByPage,
    rows,
    reproduce,
  }),
)
await writeWorkbook(path.join(ROOT, 'test-scenarios.xlsx'), {
  runId: RUN_ID,
  reproduce,
  inventory,
  rows,
  ranPages: results.length,
})

const totals = summarise(rows)
console.log(`\nEvidence: ${path.relative(process.cwd(), ROOT)}`)
console.log(
  `  report.html          ${totals.total} rows, ${totals.pass} passed, ${totals.fail} failed, ` +
    `${totals.notRun} never ran, ${totals.notExecuted} not executable`,
)
console.log(`  test-scenarios.xlsx  Summary, Test Scenarios, Traceability, Not Covered`)
console.log(
  `  <page>/videos/       one recording per executed case (${rows.filter((r) => r.evidence).length} in total)`,
)
console.log(rollupLines.slice(4).join('\n'))

const bad = results.filter((r) => r.exit !== 0 || !r.collected)
if (bad.length) {
  console.error(`\n${bad.length} page(s) failed: ${bad.map((r) => r.page).join(', ')}`)
  process.exit(1)
}
