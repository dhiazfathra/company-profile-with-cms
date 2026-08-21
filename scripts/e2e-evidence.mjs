/**
 * Produce the PR evidence pack: run the gates, then write what they actually did.
 *
 * `bun run evidence` — output lands in `e2e-evidence/` (ignored):
 *
 *   report.html     self-contained page: per-section render beside its Figma
 *                   reference, the run logs, and the negative-direction proof
 *   pr-section.md   the block to append to the pull request description
 *   run.log         raw output of every command, in order
 *
 * Two rules shape this file, both from packages/figma-to-site/SKILL.md:
 *
 * 1. Evidence is what a command reported, never what the author remembers. Every
 *    number comes out of a machine-readable report — vitest's and Playwright's
 *    JSON — rather than off a terminal summary written for a human, and a command that fails
 *    fails this script — an evidence pack that reports a pass it did not observe
 *    is worse than no evidence at all.
 * 2. A check is only known to work if it has been seen to fail. So the eval
 *    suite's structural validator is run against deliberately broken fixtures as
 *    well as the real suite, and this script errors out if a fixture it expected
 *    to be rejected is accepted.
 */
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const ROOT = dirname(dirname(new URL(import.meta.url).pathname))
const WEB = join(ROOT, 'apps/web')
const PKG = join(ROOT, 'packages/figma-to-site')
const OUT = join(ROOT, 'e2e-evidence')

/** Thumbnail width. The check itself compares at 48 cells, so this is for the reader. */
const THUMB_WIDTH = 420

const log = []
const say = (line) => {
  log.push(line)
  console.log(line)
}

/**
 * Terminal control sequences, removed from everything this script reads.
 *
 * A colourised summary reads identically to a human and not at all to a regular
 * expression: with colour on, vitest prints `Tests  \x1b[1m\x1b[32m95 passed`, and
 * `/Tests {2}(\d+)/` finds nothing. That is a formatting difference reported as a
 * missing result — the one thing this script must never do.
 */
const stripAnsi = (text) => text.replace(/\u001B\[[0-9;]*[A-Za-z]/g, '')

/**
 * Run a command, record it, and return its output. `allowFailure` exists only for
 * the negative-direction fixtures, where a non-zero exit is the expected result.
 *
 * stdout and stderr are merged. Which stream a runner picks for its summary is
 * its own business and it changes between versions; reading only one turns that
 * choice into a failure here.
 */
function run(cmd, args, { cwd = ROOT, allowFailure = false } = {}) {
  say(
    `\n$ ${[cmd, ...args].join(' ')}${cwd === ROOT ? '' : `   # in ${cwd.slice(ROOT.length + 1)}`}`,
  )
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    // Both streams, always: which one a runner writes its summary to is its own
    // business, and reading only stdout turns that choice into a failure here.
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  })
  if (result.error) throw result.error
  const out = stripAnsi(`${result.stdout ?? ''}${result.stderr ?? ''}`)
  log.push(out.trimEnd())
  if (result.status === 0) return { ok: true, out }
  if (allowFailure) return { ok: false, out }
  console.error(out)
  throw new Error(`\`${cmd} ${args.join(' ')}\` failed — nothing to report, so nothing is written`)
}

/** Pull a number out of the logs rather than trusting a count written by hand. */
function must(pattern, text, what) {
  const match = pattern.exec(text)
  if (!match) throw new Error(`could not read ${what} out of the command's output`)
  return match[1]
}

// ---------------------------------------------------------------- the gates

const sha = run('git', ['rev-parse', '--short', 'HEAD']).out.trim()
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).out.trim()

mkdirSync(OUT, { recursive: true })

/**
 * Pass count for one workspace, read out of vitest's JSON report rather than off
 * its terminal summary.
 *
 * The summary line is written for a human: its spacing, its colour and the stream
 * it lands on are all free to change, and every one of those breaks a regular
 * expression while the tests themselves are green. Parsing the report keeps this
 * script failing for the only reason it should — a test that did not pass.
 */
function unitPassCount(cwd, label) {
  const file = join(OUT, `vitest-${label}.json`)
  run('bun', ['run', 'test', '--', '--reporter=json', `--outputFile=${file}`], { cwd })
  const report = JSON.parse(readFileSync(file, 'utf8'))
  const { numTotalTests = 0, numPassedTests = 0, numFailedTests = 0 } = report
  // A run of nothing exits 0. Same rule as an empty asset scan: nothing to
  // check is a failure, not a clean bill of health.
  if (!numTotalTests) throw new Error(`${label} ran no tests at all`)
  if (numFailedTests || numPassedTests !== numTotalTests) {
    throw new Error(`${label}: ${numFailedTests} failed of ${numTotalTests}`)
  }
  return numPassedTests
}

const unitCounts = [unitPassCount(WEB, 'web'), unitPassCount(PKG, 'figma-to-site')]

run('bun', ['run', 'lint'])

/**
 * What the build produced, observed rather than remembered.
 *
 * This row said "static export" for a phase after `output: 'export'` was
 * dropped — the one hardcoded claim in a file whose whole rule is that a figure
 * has to come from the run. A static export writes `out/`; a server build does
 * not. The mtime check is because an `out/` left behind by an earlier phase
 * would otherwise answer for this build.
 */
const buildStart = Date.now()
run('bun', ['run', 'build'])
const exportIndex = join(WEB, 'out/index.html')
const buildMode =
  existsSync(exportIndex) && statSync(exportIndex).mtimeMs >= buildStart
    ? 'static export (`apps/web/out/`)'
    : 'server build, no static export'

run('bun', ['run', 'e2e'], { cwd: WEB })
// playwright.config.ts writes this alongside the list and html reporters, so the
// figures below are the run's own record rather than a reading of its console.
const e2eReport = JSON.parse(readFileSync(join(WEB, 'e2e-results/results.json'), 'utf8'))
const specs = (function walk(suites) {
  return suites.flatMap((s) => [...(s.specs ?? []), ...walk(s.suites ?? [])])
})(e2eReport.suites ?? [])
const e2eCount = e2eReport.stats?.expected ?? 0
if (!e2eCount || e2eReport.stats?.unexpected) {
  throw new Error(`e2e: ${e2eReport.stats?.unexpected ?? 0} unexpected of ${specs.length}`)
}
const sections = specs
  .filter((s) => s.ok && / matches the Figma design$/.test(s.title))
  .map((s) => s.title.replace(/ matches the Figma design$/, ''))

// ------------------------------------------- the validator, in both directions

/**
 * A temporary eval case carrying one deliberately broken grader. Written as a new
 * case directory rather than by editing a real grader: a script that rewrites
 * tracked files can leave the tree dirty if it dies halfway, and the whole point
 * of this pack is that it can be trusted.
 */
const FIXTURE = join(PKG, 'evals/zzz-evidence-fixture')
const CASE_PROMPT = `---
name: zzz-evidence-fixture
tags: [fixture]
runs: 1
allowed_tools: []
---

A temporary case written by scripts/e2e-evidence.mjs to prove the suite's own
validator can fail. It is removed again before this script exits; if you are
reading it in a diff, the script died and this directory should be deleted.
Padding to clear the prompt-length assertion, which is not what is under test
here: the grader beside this file is.
`

const FIXTURES = [
  {
    what: 'Grader with a 28-character rubric',
    expect: 'a grader states why it exists',
    grader: `---
type: regex
pattern: 'unverified'
match: contains
---

Too short to be a rubric.
`,
  },
  {
    what: 'Grader with an empty pattern and a long rubric',
    expect: 'the pattern must not be empty',
    grader: `---
type: regex
pattern: ''
match: contains
matchExample: 'anything at all'
---

A rubric long enough to clear the length assertion, so that the empty-pattern
guard is the assertion that has to fire here. The first fixture cannot prove it:
the length check runs first and would mask it.
`,
  },
  {
    what: 'Grader whose pattern can never match anything',
    expect: 'does not match its own matchExample',
    grader: `---
type: regex
pattern: '(?!)'
match: contains
matchExample: 'the badge reads 664'
---

The opposite failure to the empty pattern, and invisible from the pattern alone:
this compiles, matches no empty string, and matches nothing else either, so a
contains grader built on it can never pass. Only running it against a fragment of
a correct answer catches that.
`,
  },
]

const proofs = []
try {
  for (const fixture of FIXTURES) {
    mkdirSync(join(FIXTURE, 'graders'), { recursive: true })
    writeFileSync(join(FIXTURE, 'prompt.md'), CASE_PROMPT)
    writeFileSync(join(FIXTURE, 'graders/broken.md'), fixture.grader)

    const result = run('bun', ['run', 'test'], { cwd: PKG, allowFailure: true })
    if (result.ok) {
      throw new Error(
        `the validator ACCEPTED a fixture it must reject (${fixture.what}). ` +
          `That is a defect in packages/figma-to-site/tests/evals.test.mjs, not in this script.`,
      )
    }
    if (!result.out.includes(fixture.expect)) {
      throw new Error(
        `the validator rejected "${fixture.what}" but not for the expected reason ` +
          `(looked for "${fixture.expect}"). A proof that fires on the wrong assertion proves nothing.`,
      )
    }
    proofs.push({
      what: fixture.what,
      expected: 'reject',
      observed: must(/(AssertionError: [^\n]+)/, result.out, 'the assertion message'),
    })
    rmSync(FIXTURE, { recursive: true, force: true })
  }
} finally {
  rmSync(FIXTURE, { recursive: true, force: true })
}

proofs.push({
  what: 'The real suite, fixtures removed',
  expected: 'accept',
  observed: `${unitPassCount(PKG, 'figma-to-site-restored')} passed`,
})

// ------------------------------------------------------------------- output

const manifest = JSON.parse(readFileSync(join(WEB, 'design/refs/refs.json'), 'utf8'))
const order = Object.keys(manifest.sections)
const renderDir = join(WEB, 'e2e-results/design')

const thumb = async (path) =>
  `data:image/webp;base64,${(
    await sharp(path)
      .flatten({ background: '#fff' })
      .resize({ width: THUMB_WIDTH })
      .webp({ quality: 72 })
      .toBuffer()
  ).toString('base64')}`

const rows = []
for (const name of readdirSync(renderDir)
  .filter((f) => f.endsWith('.render.png'))
  .map((f) => f.replace('.render.png', ''))
  .sort((a, b) => order.indexOf(a) - order.indexOf(b))) {
  const reference = join(WEB, `design/refs/${name}.png`)
  if (!existsSync(reference)) throw new Error(`${name} has a render but no reference on disk`)
  rows.push({
    name,
    spec: manifest.sections[name],
    render: await thumb(join(renderDir, `${name}.render.png`)),
    reference: await thumb(reference),
  })
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const runLog = log.join('\n')
writeFileSync(join(OUT, 'run.log'), `${runLog}\n`)

const REPRODUCE = `git checkout ${branch}
bun install --frozen-lockfile
bunx playwright install chromium
bun run evidence     # this script: gates, proofs, and this pack`

writeFileSync(
  join(OUT, 'pr-section.md'),
  `# E2E evidence

Produced by \`bun run evidence\` at \`${sha}\` on \`${branch}\`. Every number below was
read out of the run's own JSON report, not off a console summary; the script fails
rather than writing a figure it did not observe.

| | |
|---|---|
| Playwright e2e, chromium | **${e2eCount} passed** |
| of which design-fidelity, one test per section | **${sections.length} passed** |
| Unit tests | **${unitCounts.reduce((a, b) => a + b, 0)} passed** (${unitCounts.join(' + ')}) |
| Lint | \`eslint .\` clean |
| Build | ${buildMode} |
| Eval validator | proven in both directions, see below |

## Reproduce

\`\`\`bash
${REPRODUCE}
\`\`\`

The e2e run is self-contained: \`apps/web/playwright.config.ts\` starts the dev
server itself and already sets \`video: 'on'\`, \`screenshot: 'on'\`, \`trace: 'on'\`,
so a rerun produces the same artefacts with no extra flags. Nothing here touches
Figma — capture is a separate, deliberately local-only command, because Figma's
CDN returns 403 to headless Chromium.

The \`e2e\` workflow uploads \`apps/web/e2e-results/\` on every run:
\`e2e-results/design/<Section>.render.png\` is the browser render each section was
checked against, and \`e2e-results/artifacts/**\` holds a \`video.webm\`, screenshots
and a Playwright trace per test (\`bunx playwright show-trace <trace.zip>\`).

## Design fidelity, per section

${rows.map((r) => `- ✓ **${r.name}** — design ${r.spec.size[0]}×${r.spec.size[1]}, sizeFrom \`${r.spec.sizeFrom}\``).join('\n')}

Two axes each: the rendered section's aspect ratio against the design size in
\`design/refs/refs.json\` — a number read off the design, so a bad reference cannot
make it lie — and a coarse 48-cell block-colour comparison against the reference
PNG. On failure the test attaches the render beside the reference to the report.

## The eval validator, proven in both directions

A detector that has only seen clean input is not known to detect anything, so the
suite's structural test is run against deliberately broken fixtures too. The
script errors out if a fixture it expected to be rejected is accepted, or if the
rejection came from the wrong assertion.

| Fixture | Expected | Observed |
|---|---|---|
${proofs.map((p) => `| ${p.what} | ${p.expected} | \`${p.observed}\` |`).join('\n')}

## What this evidence does not cover

- One browser at one viewport. Nothing compares the responsive breakpoints
  against the Figma file's mobile and tablet frames.
- The references are canvas rasters from the free-tier viewer, not asset exports:
  softer than an export, with vector icons arriving rasterised.
- Sections that are almost entirely background (\`LogoCloud\`, \`Footer\`) produce a
  low block score whatever happens. That is weak evidence, not banked fidelity.
- \`Footer\` renders the copyright as one field where the design splits it left and
  right — deliberate, per ADR-0005, and too fine for the block check to see.
- \`claude plugin eval\` itself is not run: it is early-access gated. What is proven
  is that the suite is well-formed and that the check proving it can fail.
`,
)

writeFileSync(
  join(OUT, 'report.html'),
  `<title>E2E Evidence — ${esc(branch)}</title>
<style>
  :root { --bg:#fbfbfa; --panel:#fff; --ink:#1a1a19; --muted:#6b6b66; --line:#e4e4e0; --ok:#1f7a4d; --code:#f4f4f1 }
  @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) {
    --bg:#17181a; --panel:#1f2124; --ink:#ececea; --muted:#9a9a95; --line:#32353a; --ok:#4dd08a; --code:#14161a } }
  :root[data-theme='dark'] {
    --bg:#17181a; --panel:#1f2124; --ink:#ececea; --muted:#9a9a95; --line:#32353a; --ok:#4dd08a; --code:#14161a }
  body { background:var(--bg); color:var(--ink); margin:0;
    font:15px/1.6 ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif }
  main { max-width:980px; margin:0 auto; padding:48px 24px 96px }
  h1 { font-size:28px; letter-spacing:-.02em; margin:0 0 6px }
  h2 { font-size:19px; margin:48px 0 12px; letter-spacing:-.01em }
  p,li { max-width:68ch }
  .lede { color:var(--muted); margin:0 0 32px }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px }
  .card b { display:block; font-size:24px; letter-spacing:-.02em }
  .card span { color:var(--muted); font-size:13px }
  pre { background:var(--code); border:1px solid var(--line); border-radius:10px; padding:14px 16px;
    overflow-x:auto; font-size:12.5px; line-height:1.5 }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace }
  .sec { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:18px; margin:16px 0 }
  .sec header { display:flex; flex-wrap:wrap; gap:10px; align-items:baseline;
    justify-content:space-between; margin-bottom:12px }
  .sec h3 { margin:0; font-size:16px }
  .meta { color:var(--muted); font-size:12.5px; font-family:ui-monospace,Menlo,monospace }
  .pair { display:grid; grid-template-columns:1fr 1fr; gap:14px }
  @media (max-width:640px) { .pair { grid-template-columns:1fr } }
  figure { margin:0 }
  figcaption { color:var(--muted); font-size:12px; margin-bottom:6px }
  img { width:100%; max-width:100%; display:block; border:1px solid var(--line); border-radius:6px }
  .pass { color:var(--ok); font-weight:600 }
  .note { border-left:3px solid var(--line); padding-left:14px; color:var(--muted) }
  table { border-collapse:collapse; width:100%; font-size:14px }
  th,td { text-align:left; padding:7px 10px; border-bottom:1px solid var(--line); vertical-align:top }
  th { color:var(--muted); font-weight:600; font-size:12.5px }
  .scroll { overflow-x:auto }
</style>
<main>
  <h1>E2E evidence</h1>
  <p class="lede">Branch <code>${esc(branch)}</code> at <code>${esc(sha)}</code>, produced by
  <code>bun run evidence</code>. Every figure was read out of the run's own JSON report rather
  than off a console summary — the script fails rather than printing a number it did not
  observe.</p>

  <div class="cards">
    <div class="card"><b class="pass">${esc(e2eCount)}</b><span>Playwright e2e, chromium</span></div>
    <div class="card"><b class="pass">${rows.length}</b><span>design-fidelity sections</span></div>
    <div class="card"><b class="pass">${unitCounts.reduce((a, b) => a + b, 0)}</b><span>unit tests (${esc(unitCounts.join(' + '))})</span></div>
    <div class="card"><b class="pass">${proofs.length}</b><span>validator directions proven</span></div>
  </div>

  <h2>Reproduce</h2>
<pre><code>${esc(REPRODUCE)}</code></pre>
  <p class="note">Self-contained: <code>playwright.config.ts</code> starts the dev server itself and
  already records video, screenshots and traces, so a rerun produces the same artefacts with no
  extra flags. Nothing here touches Figma — capture is a separate local-only command, because
  Figma's CDN returns 403 to headless Chromium.</p>

  <h2>Design fidelity, section by section</h2>
  <p>Each section's live browser render beside the Figma reference it was checked against. Two
  axes: the render's aspect ratio against the design size in the trust manifest, and a coarse
  48-cell block-colour comparison against the reference.</p>
  <p class="note">These thumbnails are for the reader; the check compares at 48 cells wide and so
  sees less than you do here. On a section that is mostly background a low score is weak evidence,
  and <code>Footer</code> deliberately renders the copyright as one field where the design splits
  it — the block check is too coarse to see that, so its pass is not agreement on it.</p>
  ${rows
    .map(
      (r) => `<div class="sec">
    <header>
      <h3>${esc(r.name)} <span class="pass">PASS</span></h3>
      <span class="meta">design ${r.spec.size[0]}×${r.spec.size[1]} · sizeFrom: ${esc(r.spec.sizeFrom)}${
        r.spec.blockTolerance ? ` · blockTolerance ${r.spec.blockTolerance}` : ''
      }</span>
    </header>
    <div class="pair">
      <figure><figcaption>Browser render</figcaption><img alt="${esc(r.name)} render" src="${r.render}"></figure>
      <figure><figcaption>Figma reference</figcaption><img alt="${esc(r.name)} reference" src="${r.reference}"></figure>
    </div>
  </div>`,
    )
    .join('\n')}

  <h2>The eval validator, proven in both directions</h2>
  <p>A detector that has only seen clean input is not known to detect anything, so the suite's
  structural test is run against deliberately broken fixtures as well as the real suite. This
  script errors out if a fixture it expected to be rejected is accepted, or if the rejection came
  from the wrong assertion.</p>
  <div class="scroll"><table>
    <tr><th>Fixture</th><th>Expected</th><th>Observed</th></tr>
    ${proofs
      .map(
        (p) =>
          `<tr><td>${esc(p.what)}</td><td>${esc(p.expected)}</td><td><code>${esc(p.observed)}</code></td></tr>`,
      )
      .join('\n    ')}
  </table></div>

  <h2>Run log</h2>
<pre><code>${esc(runLog)}</code></pre>

  <h2>What this evidence does not cover</h2>
  <ul>
    <li>One browser at one viewport. Nothing compares the responsive breakpoints against the
      Figma file's mobile and tablet frames.</li>
    <li>The references are canvas rasters from the free-tier viewer, not asset exports — softer
      than an export, with vector icons arriving rasterised.</li>
    <li>Sections that are almost entirely background produce a low block score whatever happens.
      Weak evidence, not banked fidelity.</li>
    <li><code>claude plugin eval</code> itself is not run: it is early-access gated. What is proven
      is that the suite is well-formed and that the check proving it can fail.</li>
  </ul>
</main>
`,
)

say(`\nwrote ${OUT.slice(ROOT.length + 1)}/report.html, pr-section.md, run.log`)
