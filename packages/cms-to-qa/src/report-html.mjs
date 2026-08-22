/**
 * The run as one page a human can read and watch.
 *
 * `report.md` is for a pull request; this is for the SIT walkthrough, where the
 * question is not "did it pass" but "show me". Every executed case has its own
 * recording embedded beside the value that was typed and the outcome that was
 * observed, so a tester can watch the case they doubt rather than take a tick on
 * trust.
 *
 * The stylesheet is passed in rather than imported. It lives in the repository's
 * `scripts/report-style.mjs` alongside the two reports it already serves, and
 * this package reaching up into the repository to fetch it would invert the
 * dependency — while a second copy of the CSS is the thing that file exists to
 * prevent.
 */
import { STATUS, pagesNotRun, summarise } from './scenarios.mjs'

export const esc = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const CLASS = {
  [STATUS.pass]: 'ok',
  [STATUS.fail]: 'bad',
  [STATUS.notRun]: 'warn',
  [STATUS.notExecuted]: 'muted',
}

/** Extra rules on top of the shared report stylesheet. */
const EXTRA = `<style>
  .badge { font-size:11.5px; font-weight:700; letter-spacing:.04em; padding:2px 7px; border-radius:999px;
    border:1px solid var(--line); white-space:nowrap }
  .badge.ok { color:var(--ok); border-color:currentColor }
  .badge.bad { color:#c0392b; border-color:currentColor }
  .badge.warn { color:#b8860b; border-color:currentColor }
  .badge.muted { color:var(--muted) }
  video { width:100%; border:1px solid var(--line); border-radius:6px; background:#000; display:block }
  details.case { border:1px solid var(--line); border-radius:10px; background:var(--panel); margin:8px 0 }
  details.case > summary { cursor:pointer; padding:10px 14px; display:flex; gap:10px; align-items:center;
    flex-wrap:wrap; font-size:14px }
  details.case > summary::-webkit-details-marker { display:none }
  details.case > summary code { font-size:13px }
  details.case .body { padding:0 14px 14px; display:grid; grid-template-columns:1fr 1fr; gap:16px }
  @media (max-width:720px) { details.case .body { grid-template-columns:1fr } }
  dl { margin:0; font-size:13.5px }
  dt { color:var(--muted); font-size:12px; margin-top:9px }
  dd { margin:2px 0 0 }
  .gaps li { margin-bottom:7px }
  .pill { font-family:ui-monospace,Menlo,monospace; font-size:12px; color:var(--muted) }
</style>`

const badge = (status) => `<span class="badge ${CLASS[status] ?? 'muted'}">${esc(status)}</span>`

function caseBlock(row) {
  const video = row.evidence
    ? `<figure><figcaption>Recording of this case</figcaption>
      <video controls preload="none" src="${esc(row.evidence)}"></video></figure>`
    : `<figure><figcaption>Recording</figcaption><p class="note">No recording for this row — ${
        row.status === STATUS.notExecuted
          ? 'the case was never executed.'
          : 'the case did not run, so no video was produced.'
      }</p></figure>`
  return `<details class="case">
  <summary>${badge(row.status)} <code>${esc(row.id)}</code>
    <code>${esc(row.field)}</code> · ${esc(row.caseId)} <span class="pill">${esc(row.category)}</span></summary>
  <div class="body">
    <dl>
      <dt>Test data</dt><dd><code>${esc(row.testData)}</code></dd>
      <dt>Expected</dt><dd>${esc(row.expected)}</dd>
      <dt>Observed</dt><dd>${esc(row.actual)}</dd>
      ${row.publicPage ? `<dt>Public page</dt><dd>${esc(row.publicPage)}</dd>` : ''}
      <dt>Steps, by hand</dt><dd><ol>${row.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></dd>
    </dl>
    ${video}
  </div>
</details>`
}

function pageSection(pageInfo, rows, result, exitCode) {
  const s = summarise(rows)
  // `null` rather than `undefined`: the caller only passes pages the run
  // targeted, so the key exists and a null value means Playwright wrote no
  // report for it.
  const verdict =
    result === null ? STATUS.notExecuted : s.fail > 0 || exitCode !== 0 ? STATUS.fail : STATUS.pass
  return `<h2 id="${esc(pageInfo.page)}">${esc(pageInfo.page)} ${badge(verdict)}</h2>
<p class="meta">${esc(pageInfo.kind)} · admin <code>${esc(pageInfo.adminUrl)}</code>${
    pageInfo.section
      ? ` · renders as <code>[data-section="${esc(pageInfo.section)}"]</code>`
      : ' · no rendered section'
  }</p>
<div class="cards">
  <div class="card"><b>${s.total}</b><span>rows in the matrix</span></div>
  <div class="card"><b class="${s.fail ? '' : 'pass'}">${s.pass}</b><span>passed</span></div>
  <div class="card"><b>${s.fail}</b><span>failed</span></div>
  <div class="card"><b>${s.notRun + s.notExecuted}</b><span>never ran / not executable</span></div>
</div>
${rows.map(caseBlock).join('\n')}`
}

/**
 * @param {object} o
 * @param {string} o.css        the shared report stylesheet
 * @param {string} o.runId
 * @param {object} o.inventory
 * @param {Map} o.resultsByPage page -> {tests, log} | null
 * @param {Map} o.exitByPage    page -> runner exit code
 * @param {Array} o.rows        scenario rows, from buildScenarios()
 * @param {string} o.reproduce  the command that regenerates this
 */
export function renderReport({
  css,
  runId,
  inventory,
  resultsByPage,
  exitByPage,
  rows,
  reproduce,
}) {
  const s = summarise(rows)
  // Only the pages this run targeted get a section. The rest are named under
  // "Pages not run" — a matrix of rows nobody asked for buries the result that
  // was asked for.
  const ran = inventory.pages.filter((p) => resultsByPage.has(p.page))
  const notRun = pagesNotRun(inventory, resultsByPage)
  const byPage = new Map(ran.map((p) => [p.page, rows.filter((r) => r.page === p.page)]))

  return `<title>CMS field matrix — SIT evidence</title>
${css}
${EXTRA}
<main>
  <h1>CMS field matrix — SIT evidence</h1>
  <p class="lede">Run <code>${esc(runId)}</code>. Every field the CMS exposes on the pages this run
  targeted, driven through the admin panel one case at a time, with the recording of each case beside
  the value that was typed and the outcome that was observed. Every figure on this page is read from
  Playwright's own JSON report and from the run's case log — never from a console summary.</p>

  <div class="cards">
    <div class="card"><b>${ran.length}</b><span>pages run (of ${inventory.pages.length} discovered)</span></div>
    <div class="card"><b class="${s.fail ? '' : 'pass'}">${s.pass}</b><span>cases passed</span></div>
    <div class="card"><b>${s.fail}</b><span>cases failed</span></div>
    <div class="card"><b>${s.notRun}</b><span>never ran</span></div>
    <div class="card"><b>${s.notExecuted}</b><span>not executable</span></div>
  </div>

  <h2>Reproduce</h2>
<pre><code>${esc(reproduce)}</code></pre>
  <p class="note">Local only, against <code>next dev</code> on port 3100, which Playwright starts
  itself. Every case writes to the database and each field is restored after its cases finish, so
  the run is repeatable — but a crashed run leaves the last value behind and
  <code>bun run --cwd apps/web seed</code> is what puts it back. Do not point this at a shared
  database.</p>

  <h2>Result by page</h2>
  <div class="scroll"><table>
    <tr><th>Page</th><th>Result</th><th>Rows</th><th>Passed</th><th>Failed</th><th>Never ran</th><th>Not executable</th></tr>
    ${ran
      .map((p) => {
        const t = summarise(byPage.get(p.page) ?? [])
        const exit = exitByPage.get(p.page)
        const verdict = t.fail > 0 || exit !== 0 ? STATUS.fail : STATUS.pass
        return `<tr><td><a href="#${esc(p.page)}">${esc(p.page)}</a></td><td>${badge(verdict)}</td>
      <td>${t.total}</td><td>${t.pass}</td><td>${t.fail}</td><td>${t.notRun}</td><td>${t.notExecuted}</td></tr>`
      })
      .join('\n    ')}
  </table></div>
  ${
    notRun.length
      ? `<p class="note"><b>Pages not run by this invocation:</b> ${notRun.map((p) => `<code>${esc(p)}</code>`).join(', ')}.
    Their matrices are generated at <code>&lt;page&gt;/field-matrix.md</code> and no case was executed
    against them. Nothing on this page is evidence about them — run <code>bun run cms:e2e --all</code>
    for the whole CMS.</p>`
      : '<p class="note">Every discovered page was run.</p>'
  }

  <h2>Saved, but not observed on the public page</h2>
  <p>The failure this suite exists to catch, and the one a green run does not report: a value an
  editor can save that never reaches the page. Either no component renders that field, or it renders
  from something other than the CMS. The run cannot tell which.</p>
  ${
    s.notRendered
      ? `<div class="scroll"><table>
    <tr><th>Page</th><th>Field</th><th>Case</th></tr>
    ${rows
      .filter((r) => r.publicPage.startsWith('NOT found'))
      .map(
        (r) =>
          `<tr><td>${esc(r.page)}</td><td><code>${esc(r.field)}</code></td><td>${esc(r.caseId)}</td></tr>`,
      )
      .join('\n    ')}
  </table></div>`
      : '<p class="note">None in this run.</p>'
  }

  ${ran
    .map((p) =>
      pageSection(p, byPage.get(p.page) ?? [], resultsByPage.get(p.page), exitByPage.get(p.page)),
    )
    .join('\n\n')}

  <h2>What this run does not cover</h2>
  <ul class="gaps">
    <li><b>Draft versus published.</b> ${
      inventory.versions.length
        ? `Versions are enabled on ${esc(inventory.versions.join(', '))}, and this run exercises neither state.`
        : 'Nothing in this config enables <code>versions</code>, so there is no draft state to test.'
    }</li>
    <li><b>Per-role permissions.</b> ${
      inventory.roleFields.length
        ? `Role fields found: ${esc(inventory.roleFields.join(', '))}.`
        : 'The auth collection has no role or select field, so no field is permission-restricted.'
    }</li>
    <li><b>Locales.</b> Configured: <code>${esc(inventory.locales.join(', '))}</code>. ${
      inventory.locales.length > 1
        ? 'Only the default locale is exercised.'
        : 'With one locale a localized field has one value, so localization can neither be shown to work nor to fail.'
    }</li>
    <li><b>Concurrent editors.</b> One session at a time. Two editors saving the same field at once
      is not exercised.</li>
    <li><b>Unsaved-changes warnings.</b> Every case saves; navigating away from a dirty form is not
      exercised.</li>
    <li><b>Uploads as uploads.</b> Upload fields select existing media rather than posting a file, so
      no type or size limit is exercised. Configured limits: ${
        inventory.uploads?.length
          ? esc(
              inventory.uploads
                .map(
                  (u) =>
                    `${u.collection} (mimeTypes: ${u.mimeTypes ? u.mimeTypes.join(', ') : 'none'}, filesize: ${u.filesize ?? 'none'})`,
                )
                .join('; '),
            )
          : 'no upload collection in this config'
      }.</li>
    <li><b>Layout.</b> A value can save, render, and still break the design.
      <code>bun run verify:design</code> is that check, and it is not run here.</li>
    <li><b>Fields with no row above.</b> None — a field this run could not execute is listed with
      NOT EXECUTED and its reason, so the count above is the whole field list and not just the part
      that worked.</li>
  </ul>
  <p class="note">Deleting this section turns a pass into a claim nobody made. If you add a check,
  add its blind spot with it.</p>
</main>
`
}
