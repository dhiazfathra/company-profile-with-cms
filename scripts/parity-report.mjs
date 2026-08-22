/**
 * Three-way parity: Figma, local, deployed.
 *
 * `bun run parity-report` — output lands in `parity-report/` (ignored):
 *
 *   parity-report/report.html   per-feature status across all three, for a human
 *   parity-report/report.json   the same rows, machine-readable
 *
 * Why this exists separately from `bun run evidence`. The evidence pack compares
 * the *local* render against the Figma references and stops there. A deployment
 * is a third thing, and it can differ from local in ways no local gate can see:
 * the same commit, the same green build, a different database and a different
 * filesystem. That is not hypothetical — it is what shipped. Every image on the
 * deployed homepage returned 500 from `/api/media/file/...` while local served
 * the identical markup, because Payload's uploads went to a gitignored directory
 * that is not in the deployment bundle. The build was green throughout. See
 * ADR-0014.
 *
 * So this script asserts nothing about how the code was built. It asks each of
 * the three sources the same questions and prints where they disagree:
 *
 *   Figma   — is there a vouched reference for this section, and a node id
 *             saying where in the file it came from? Read from the committed
 *             `apps/web/design/figma.targets.json` and `design/refs/refs.json`;
 *             the Figma API is never called, because capture is local-only
 *             (ADR-0007: Figma's CDN 403s headless Chrome).
 *   local   — does the running dev server render the section, with text, and do
 *             the images inside it actually load?
 *   deployed— the same three questions against the deployment URL.
 *
 * Exit code is 1 when any row disagrees across environments, so this is
 * wireable as a post-deploy CI step. `--skip-local` drops the local column for
 * a CI run that has no dev server, and reports what it dropped rather than
 * quietly scoring a two-way check as a three-way pass.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REPORT_CSS } from './report-style.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WEB = join(ROOT, 'apps/web')
const OUT = join(ROOT, 'parity-report')

const DEFAULT_LOCAL = 'http://localhost:3000'
const DEFAULT_PROD = 'https://company-profile-with-cms-web.vercel.app'

const argv = process.argv.slice(2)
function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}
const skipLocal = argv.includes('--skip-local')
const localUrl = (flag('local', process.env.PARITY_LOCAL_URL || DEFAULT_LOCAL) || '').replace(
  /\/$/,
  '',
)
const prodUrl = (flag('prod', process.env.PARITY_PROD_URL || DEFAULT_PROD) || '').replace(/\/$/, '')

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

/** The Figma source of truth. Both files are committed; neither is derived. */
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}
const targets = readJson(join(WEB, 'design/figma.targets.json'))
const refs = readJson(join(WEB, 'design/refs/refs.json'))

/**
 * `figma.targets.json` names capture *targets*, which are not one-to-one with
 * page sections: `Showcase` crops the frame that `ShowcaseImage` renders, and
 * several sections were captured as part of a larger frame and so have no entry
 * of their own. A missing node id is therefore reported as "no node id
 * recorded", not as a failure — the reference PNG and its `blockCheck` vouch are
 * what the design gate actually trusts.
 */
const NODE_BY_SECTION = { ShowcaseImage: 'Showcase' }
function figmaNode(section, from = targets) {
  const name = NODE_BY_SECTION[section] ?? section
  return from.targets.find((t) => t.name === name)
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    return { ok: res.ok, status: res.status, body: res.ok ? await res.text() : '' }
  } catch (err) {
    return { ok: false, status: 0, body: '', error: String(err.message ?? err) }
  }
}

async function head(url) {
  try {
    // Some hosts answer HEAD from a different path than GET; ask for one byte
    // instead, so a 500 that only GET would produce is not missed.
    const res = await fetch(url, { headers: { range: 'bytes=0-0' } })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, status: 0, error: String(err.message ?? err) }
  }
}

/**
 * Slices the page into its sections on the `data-section` markers the section
 * components emit, so an image can be attributed to the section that renders it
 * rather than to the page as a whole.
 */
export function sliceSections(html) {
  const marks = [...html.matchAll(/data-section="([^"]+)"/g)]
  const out = new Map()
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : html.length
    out.set(m[1], html.slice(m.index, end))
  })
  return out
}

export function imageSrcs(fragment) {
  return [...fragment.matchAll(/<img[^>]+src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((src) => !src.startsWith('data:'))
}

export function visibleText(fragment) {
  return fragment
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Probes one environment and returns a per-section verdict plus page-level facts. */
async function probe(baseUrl) {
  const page = await fetchText(baseUrl + '/')
  if (!page.ok) {
    return { reachable: false, status: page.status, error: page.error, sections: new Map() }
  }
  const admin = await head(baseUrl + '/admin')
  const slices = sliceSections(page.body)
  const sections = new Map()
  for (const [name, fragment] of slices) {
    const srcs = imageSrcs(fragment)
    const images = []
    for (const src of srcs) {
      const absolute = src.startsWith('http') ? src : baseUrl + src
      images.push({ src, ...(await head(absolute)) })
    }
    sections.set(name, { rendered: true, text: visibleText(fragment), images })
  }
  return { reachable: true, status: page.status, admin, sections }
}

/**
 * Three sources agree when every state that was actually checked is the same.
 * `warn` counts as agreement: an unvouched design reference is a gap in what we
 * can claim about the design, not a difference between environments, and making
 * it fail here would hide the environment differences this report exists to
 * find. `skipped` is excluded for the same reason and named in the report.
 */
export function agrees(states) {
  const checked = states.filter((s) => s !== 'skipped').map((s) => (s === 'warn' ? 'pass' : s))
  return new Set(checked).size <= 1
}

export function verdict(env, section) {
  if (!env) return { state: 'skipped', detail: 'not checked' }
  if (!env.reachable) {
    return { state: 'fail', detail: `page unreachable (${env.status || env.error})` }
  }
  const s = env.sections.get(section)
  if (!s) return { state: 'fail', detail: 'section not rendered' }
  const broken = s.images.filter((i) => !i.ok)
  if (broken.length > 0) {
    const worst = broken[0]
    return {
      state: 'fail',
      detail: `${broken.length}/${s.images.length} image${broken.length === 1 ? '' : 's'} failed — ${worst.src} returned ${worst.status || worst.error}`,
    }
  }
  if (s.text.length === 0 && s.images.length === 0) {
    return { state: 'fail', detail: 'rendered but empty: no text and no images' }
  }
  return {
    state: 'pass',
    detail: `${s.images.length} image${s.images.length === 1 ? '' : 's'} ok, ${s.text.length} chars of text`,
  }
}

export function figmaVerdict(section, source = { refs, targets }) {
  const ref = source.refs.sections[section]
  if (!ref) return { state: 'fail', detail: 'no entry in design/refs/refs.json' }
  const node = figmaNode(section, source.targets)
  const where = node ? `node ${node.node}` : 'no node id recorded'
  if (!ref.blockCheck) {
    return {
      state: 'warn',
      detail: `reference present but not vouched for content (blockCheck false) — ${where}`,
    }
  }
  return { state: 'pass', detail: `${ref.size[0]}×${ref.size[1]} from ${ref.sizeFrom}, ${where}` }
}

async function main() {
  const local = skipLocal ? null : await probe(localUrl)
  const prod = await probe(prodUrl)

  const sectionNames = Object.keys(refs.sections)
  const rows = sectionNames.map((section) => {
    const figma = figmaVerdict(section)
    const l = verdict(local, section)
    const p = verdict(prod, section)
    return { section, figma, local: l, prod: p, agree: agrees([figma.state, l.state, p.state]) }
  })

  /**
   * Page-level rows. The admin panel is the one that is easy to forget: it is the
   * reason the site stopped being a static export, and a deployment can serve the
   * homepage perfectly while the panel an editor actually uses is broken.
   */
  const pageRows = [
    {
      label: 'Admin panel reachable (/admin)',
      figma: { state: 'skipped', detail: 'not a design surface' },
      local: local
        ? local.reachable && local.admin.ok
          ? { state: 'pass', detail: `${local.admin.status}` }
          : { state: 'fail', detail: `${local.admin?.status ?? local.status}` }
        : { state: 'skipped', detail: 'not checked' },
      prod:
        prod.reachable && prod.admin.ok
          ? { state: 'pass', detail: `${prod.admin.status}` }
          : { state: 'fail', detail: `${prod.admin?.status ?? prod.status}` },
    },
  ]
  pageRows.forEach((r) => {
    const states = [r.local.state, r.prod.state]
    r.agree = agrees(states) && !states.includes('fail')
  })

  const disagreements = [...rows, ...pageRows].filter((r) => !r.agree)

  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  const generatedFrom = {
    figmaFile: targets.fileKey,
    figmaFileName: targets.fileName,
    localUrl: skipLocal ? null : localUrl,
    prodUrl,
  }
  writeFileSync(
    join(OUT, 'report.json'),
    JSON.stringify({ generatedFrom, rows, pageRows, disagreements: disagreements.length }, null, 2),
  )

  const BADGE = { pass: '✓ matches', fail: '✗ differs', warn: '△ unvouched', skipped: '– skipped' }
  const cell = (v) =>
    `<td class="v ${v.state}"><b>${BADGE[v.state]}</b><span>${esc(v.detail)}</span></td>`

  const tableRows = [...rows, ...pageRows]
    .map(
      (r) => `<tr class="${r.agree ? '' : 'bad'}">
      <th scope="row">${esc(r.section ?? r.label)}</th>
      ${cell(r.figma)}${cell(r.local)}${cell(r.prod)}
    </tr>`,
    )
    .join('\n')

  writeFileSync(
    join(OUT, 'report.html'),
    `<title>Three-way parity — Figma, local, deployed</title>
${REPORT_CSS}
<style>
  td.v b { display:block; font-size:13px }
  td.v span { color:var(--muted); font-size:12px }
  td.v.pass b { color:var(--ok) }
  td.v.fail b { color:#c0392b }
  @media (prefers-color-scheme: dark) { :root:not([data-theme='light']) td.v.fail b { color:#ff7b6b } }
  :root[data-theme='dark'] td.v.fail b { color:#ff7b6b }
  td.v.warn b, td.v.skipped b { color:var(--muted) }
  tr.bad th { border-left:3px solid #c0392b; padding-left:11px }
</style>
<main>
  <h1>Three-way parity</h1>
  <p class="lede">The same questions asked of the design, of the site running on this machine, and
  of the site the public sees. Produced by <code>bun run parity-report</code>.</p>

  <div class="cards">
    <div class="card"><b class="${disagreements.length === 0 ? 'pass' : ''}">${disagreements.length}</b><span>rows where the three disagree</span></div>
    <div class="card"><b>${rows.length}</b><span>sections compared</span></div>
    <div class="card"><b>${skipLocal ? 2 : 3}</b><span>sources checked</span></div>
  </div>

  <h2>What was compared</h2>
  <div class="scroll"><table>
    <tr><th>Source</th><th>Where it came from</th></tr>
    <tr><td>Figma</td><td><code>apps/web/design/figma.targets.json</code> (file
      <code>${esc(targets.fileKey)}</code>) and <code>design/refs/refs.json</code></td></tr>
    <tr><td>Local</td><td>${skipLocal ? '<span class="meta">skipped (--skip-local)</span>' : `<code>${esc(localUrl)}</code>`}</td></tr>
    <tr><td>Deployed</td><td><code>${esc(prodUrl)}</code></td></tr>
  </table></div>

  <h2>Per feature, across all three</h2>
  <div class="scroll"><table>
    <tr><th>Feature</th><th>Figma</th><th>Local</th><th>Deployed</th></tr>
    ${tableRows}
  </table></div>

  <h2>What this does not cover</h2>
  <ul>
    <li>Figma is read from committed references, never from the Figma API. Capture is a local-only
      command because Figma's CDN returns 403 to headless Chrome (ADR-0007), so a design changed in
      Figma since the last <code>bun run capture:figma</code> shows here as agreement.</li>
    <li>A section counts as present when its marker renders, its text is non-empty and its images
      load. That is availability, not fidelity — the pixel-level comparison against the design lives
      in <code>bun run evidence</code> and is not repeated here.</li>
    <li>Only the default locale and the homepage are fetched. A second locale, the admin panel's
      contents, and every route other than <code>/</code> and <code>/admin</code> are unchecked.</li>
    <li>Text is compared for presence, not for equality between environments: local and deployed
      read from different databases, and an editor's legitimate change would otherwise read as a
      failure.</li>
    ${skipLocal ? '<li><b>The local column was skipped for this run</b>, so nothing here separates a local-only defect from a deployment-only one.</li>' : ''}
  </ul>

  <h2>Reproduce</h2>
<pre><code>bun install
cp apps/web/.env.example apps/web/.env   # set PAYLOAD_SECRET
bun run --cwd apps/web seed
bun run dev                              # in another shell
bun run parity-report</code></pre>
</main>
`,
  )

  console.log(`parity-report/report.html written — ${disagreements.length} disagreement(s)`)
  for (const d of disagreements) {
    console.log(
      `  ${d.section ?? d.label}: figma=${d.figma.state} local=${d.local.state} deployed=${d.prod.state}`,
    )
    for (const [env, v] of [
      ['local', d.local],
      ['deployed', d.prod],
    ]) {
      if (v.state === 'fail') console.log(`    ${env}: ${v.detail}`)
    }
  }
  if (disagreements.length > 0) process.exitCode = 1
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isMain) await main()
