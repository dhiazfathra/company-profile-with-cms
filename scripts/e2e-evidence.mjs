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
import { REPORT_CSS } from './report-style.mjs'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
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
function run(cmd, args, { cwd = ROOT, allowFailure = false, env = {} } = {}) {
  say(
    `\n$ ${[cmd, ...args].join(' ')}${cwd === ROOT ? '' : `   # in ${cwd.slice(ROOT.length + 1)}`}`,
  )
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    // Both streams, always: which one a runner writes its summary to is its own
    // business, and reading only stdout turns that choice into a failure here.
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', ...env },
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
/**
 * payload.config.ts throws rather than fall back to its dev secret when
 * NODE_ENV is production, which `next build` sets — so a production build
 * cannot load the config without this. Deliberately not a secret: the same
 * kind of throwaway value the e2e workflow's build step uses, against a sqlite
 * file this run creates and nothing outside it reads.
 */
const SECRET = process.env.PAYLOAD_SECRET ?? 'evidence-secret'

const buildStart = Date.now()
run('bun', ['run', 'build'], { env: { PAYLOAD_SECRET: SECRET } })
const exportIndex = join(WEB, 'out/index.html')
const buildMode =
  existsSync(exportIndex) && statSync(exportIndex).mtimeMs >= buildStart
    ? 'static export (`apps/web/out/`)'
    : 'server build, no static export'

/**
 * The account `e2e/cms-round-trip.spec.ts` logs in as, to change a value through
 * the API the way an editor would. Not a secret: it exists only in the sqlite
 * file this run seeds, and that test refuses to run rather than skip if it is
 * missing — a round-trip proof that silently stops running is worse than none.
 */
const E2E_USER = {
  E2E_USER_EMAIL: 'e2e@example.com',
  E2E_USER_PASSWORD: 'e2e-evidence-password',
  PAYLOAD_SECRET: SECRET,
}

run('bun', ['run', 'seed'], { cwd: WEB, env: E2E_USER })
run('bun', ['run', 'e2e'], { cwd: WEB, env: E2E_USER })
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

/**
 * The round trip is called out on its own because it is the only check that can
 * tell a CMS-backed page from a page with the same words hardcoded in it — every
 * other check passes either way. Located in the report rather than assumed: if
 * the spec is renamed or deleted, this fails instead of quietly reporting a
 * proof that no longer runs.
 */
const ROUND_TRIP = 'a value changed in the CMS appears on the landing page'
const roundTrip = specs.find((s) => s.title === ROUND_TRIP)
if (!roundTrip?.ok) {
  throw new Error(`the CMS round-trip proof did not run or did not pass: "${ROUND_TRIP}"`)
}

/**
 * The editor's journey, as that test walked it: the admin form holding the old
 * value, holding the new one, and the page on either side of the save.
 *
 * Copied out now, before the failing-direction proof below re-runs the same spec
 * and overwrites the first three of these with a failed run's screenshots. Left
 * in place, the report would show a passing run's values beside a failing run's
 * pictures and nothing would say so.
 */
const TRIP_SRC = join(WEB, 'e2e-results/round-trip')
const TRIP = join(OUT, 'round-trip')
rmSync(TRIP, { recursive: true, force: true })
if (!existsSync(join(TRIP_SRC, 'values.json'))) {
  throw new Error(
    `the round trip passed but wrote no ${join(TRIP_SRC, 'values.json')}. The report's ` +
      `before/after has to come from the run, so this is a failure, not a missing extra.`,
  )
}
cpSync(TRIP_SRC, TRIP, { recursive: true })

const tripValues = JSON.parse(readFileSync(join(TRIP, 'values.json'), 'utf8'))
if (!tripValues.before || !tripValues.after || tripValues.before === tripValues.after) {
  throw new Error(
    `round-trip values prove nothing: before ${JSON.stringify(tripValues.before)}, ` +
      `after ${JSON.stringify(tripValues.after)}`,
  )
}
const TRIP_SHOTS = [
  ['1-landing-before', 'The landing page, before any edit'],
  ['2-admin-login', 'Signing in to /admin as the editor'],
  ['3-admin-before', `${tripValues.adminUrl} — the ${tripValues.field} field as seeded`],
  ['4-admin-after', 'The same field after the edit was saved, reloaded from the database'],
  ['5-landing-after', 'The landing page again — no rebuild, no redeploy'],
]
for (const [name] of TRIP_SHOTS) {
  if (!existsSync(join(TRIP, `${name}.png`))) {
    throw new Error(`the round trip did not capture ${name}.png; the report would claim it did`)
  }
}

/**
 * And the same check in the failing direction: hardcode the headline back into
 * the component, the way Phase 1 had it, and the round trip must fail.
 *
 * Passing proves the page agrees with the CMS. It does not prove the page *reads*
 * the CMS — a component with the seed's own string baked in passes too, which is
 * precisely the arrangement Phase 2 replaced. Only this failure distinguishes
 * them, so it is produced here rather than asserted.
 */
const HEADER = join(WEB, 'components/sections/Header.tsx')
const headerSource = readFileSync(HEADER, 'utf8')
const LIVE = '{c.headline as string}'
if (!headerSource.includes(LIVE)) {
  throw new Error(`${HEADER} no longer renders ${LIVE}; this proof needs rewriting, not skipping`)
}

let roundTripNegative
try {
  writeFileSync(HEADER, headerSource.replace(LIVE, "{'Browse everything.'}"))
  // --no-deps: the round-trip project declares `chromium` as a dependency so it
  // runs last in a full run, but this proof only needs the one test, and the rest
  // of the suite would fail here too against a deliberately broken component.
  const args = ['playwright', 'test', '--project=round-trip', '--no-deps', '--retries=0']
  const broken = run('bunx', args, {
    cwd: WEB,
    allowFailure: true,
    env: E2E_USER,
  })
  if (broken.ok) {
    throw new Error(
      'the round trip PASSED against a hardcoded headline. The test cannot tell a ' +
        'CMS-backed page from a baked-in one, which is the only thing it exists to do.',
    )
  }
  roundTripNegative = must(/(Received: +"[^"]*")/, broken.out, 'the hardcoded value it received')
} finally {
  writeFileSync(HEADER, headerSource)
}

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

const thumb = async (path, width = THUMB_WIDTH) =>
  `data:image/webp;base64,${(
    await sharp(path)
      .flatten({ background: '#fff' })
      .resize({ width })
      .webp({ quality: 72 })
      .toBuffer()
  ).toString('base64')}`

/**
 * Wider than the design thumbnails: the point of these is that a reader can
 * read the headline and the form field, not just see that a picture changed.
 */
const tripShots = []
for (const [name, caption] of TRIP_SHOTS) {
  tripShots.push({ name, caption, src: await thumb(join(TRIP, `${name}.png`), 880) })
}

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
| CMS round trip | **passed** — a value written to Payload reaches the rendered page |
| Eval validator | proven in both directions, see below |

## The CMS is actually the source of the page

Phase 2's whole claim is that an editor changes a value in the CMS and the public
page shows it. Nothing else in this pack can tell that apart from a page with the
same words hardcoded in it: the seed writes into Payload exactly the strings
Phase 1 baked into the components, so every render check and every
design-fidelity comparison passes either way.

\`apps/web/e2e/cms-round-trip.spec.ts\` signs in to \`/admin\` as an editor, opens
\`${tripValues.adminUrl}\`, and changes \`${tripValues.field}\` to a value no fixture
contains — then requires it on the page and in the server's HTML, and restores
the original so the test is re-runnable and the design comparison is not left
looking at a mutated headline.

| Field | Before | After |
|---|---|---|
| \`${tripValues.section}.${tripValues.field}\` | \`${tripValues.before}\` | \`${tripValues.after}\` |

Both values were read out of the run — the before from the admin form itself, the
after required on the page. \`e2e-evidence/report.html\` carries the five
screenshots the test took along the way: the page before, the login, the field as
seeded, the field after saving (reloaded from the database, so the form is not
merely echoing what was typed), and the page after. No rebuild and no redeploy
between those last two.

Passing proves the page agrees with the CMS, which a component with the seed's
own string baked into it also does — that is the Phase 1 arrangement, and it is
what this check has to be able to reject. So this run also put the hardcoded
headline back into \`components/sections/Header.tsx\` and required the round trip
to fail. It did, reporting the baked-in value:

\`\`\`
${roundTripNegative}
\`\`\`

## Reproduce

\`\`\`bash
${REPRODUCE}
\`\`\`

The e2e run is self-contained: \`apps/web/playwright.config.ts\` starts the dev
server itself, so a rerun needs no extra flags. Nothing here touches Figma —
capture is a separate, deliberately local-only command, because Figma's CDN
returns 403 to headless Chromium.

The \`e2e\` workflow uploads \`apps/web/e2e-results/\` on every run:
\`e2e-results/design/<Section>.render.png\` is the browser render each section was
checked against — captured explicitly by the fidelity spec, so it is present on a
pass. Video, screenshots and traces are \`retain-on-failure\`, so
\`e2e-results/artifacts/**\` is empty on a green run and holds a \`video.webm\` plus a
trace (\`bunx playwright show-trace <trace.zip>\`) for exactly the tests that
failed. Recording all three for every passing test cost a few hundred MB a run
and answered nothing.

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
- The round trip edits one text field of one global in one locale. It proves the
  seam is real; it does not exercise uploads, collections, or a second locale's
  fallback, and it says nothing about editor permissions beyond the one account it
  signs in as.
- \`claude plugin eval\` itself is not run: it is early-access gated. What is proven
  is that the suite is well-formed and that the check proving it can fail.
`,
)

writeFileSync(
  join(OUT, 'report.html'),
  `<title>E2E Evidence — ${esc(branch)}</title>
${REPORT_CSS}
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
  needs no extra flags. Video and traces are kept only for failing tests; the section renders
  below are captured explicitly, so they are here on a pass. Nothing here touches Figma — capture is a separate local-only command, because
  Figma's CDN returns 403 to headless Chromium.</p>

  <h2>An editor changes a value and the page follows</h2>
  <p>Phase 2's whole claim, walked through the admin UI by
  <code>apps/web/e2e/cms-round-trip.spec.ts</code> and captured as it went. Nothing else in this
  pack can tell this apart from a page with the same words hardcoded in it: the seed writes into
  Payload exactly the strings Phase 1 baked into the components, so every render check and every
  comparison below passes either way.</p>
  <div class="scroll"><table>
    <tr><th>Field</th><th>Before</th><th>After</th></tr>
    <tr>
      <td><code>${esc(tripValues.section)}.${esc(tripValues.field)}</code><br>
        <span class="meta">${esc(tripValues.adminUrl)}</span></td>
      <td><code>${esc(tripValues.before)}</code></td>
      <td><code>${esc(tripValues.after)}</code></td>
    </tr>
  </table></div>
  <p class="note">The "after" value carries a timestamp and exists nowhere in the repository, so a
  cached render cannot pass for a fresh one. Both values were read out of the run — the "before"
  from the admin form itself, the "after" required on the page — and the test restores the original
  afterwards, so it is re-runnable and the design comparison below is not left looking at a mutated
  headline.</p>
  ${tripShots
    .map(
      (s) => `<div class="sec">
    <header><h3>${esc(s.caption)}</h3><span class="meta">${esc(s.name)}.png</span></header>
    <img alt="${esc(s.caption)}" src="${s.src}">
  </div>`,
    )
    .join('\n')}
  <p class="note">Passing proves the page agrees with the CMS — which a component with the seed's
  own string baked into it also does. That is the Phase 1 arrangement, and it is what this check has
  to be able to reject, so this run also put the hardcoded headline back into
  <code>components/sections/Header.tsx</code> and required the round trip to fail. It did, reporting
  the baked-in value: <code>${esc(roundTripNegative)}</code></p>

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
    <li>The round trip edits one text field of one global in one locale. It proves the seam is
      real; it does not exercise uploads, collections, or a second locale's fallback, and it says
      nothing about editor permissions beyond the one account it signs in as.</li>
    <li><code>claude plugin eval</code> itself is not run: it is early-access gated. What is proven
      is that the suite is well-formed and that the check proving it can fail.</li>
  </ul>
</main>
`,
)

say(`\nwrote ${OUT.slice(ROOT.length + 1)}/report.html, pr-section.md, run.log`)
