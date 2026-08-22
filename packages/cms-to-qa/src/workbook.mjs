/**
 * The run as a test-scenario workbook — the artefact a manual tester actually
 * works in: filter to the failures, read the steps, repeat one by hand, sign the
 * sheet, hand it to UAT.
 *
 * Written with `exceljs` rather than by hand, and that is a deliberate dependency
 * (ADR-0019). A workbook is a zip of XML, and the values in these cells are
 * exactly the ones that break a naive writer: the `special` case carries
 * `& " ' < >` at once, `unicode` carries astral-plane characters that are
 * surrogate pairs in XML, and `long` is 5000 characters. Getting any of those
 * subtly wrong produces a file Excel offers to "repair" — an evidence artefact
 * that lies about a run that was fine.
 *
 * Four sheets, because a tester reads them in this order:
 *   Summary        — the verdict, the totals, and what the run could not see
 *   Test Scenarios — one row per case: steps, data, expected, actual, status
 *   Traceability   — one row per field: is it covered at all, and by how many cases
 *   Not Covered    — the gaps, restated so they survive being filtered away above
 */
import ExcelJS from 'exceljs'
import { STATUS, summarise } from './scenarios.mjs'

const HEADER_FILL = 'FF1F2933'
const STATUS_FILL = {
  [STATUS.pass]: 'FFDDF3E4',
  [STATUS.fail]: 'FFF9DEDC',
  [STATUS.notRun]: 'FFFDF1D6',
  [STATUS.notExecuted]: 'FFEFEFED',
}

/** Column widths a human chose, because auto-fit does not exist in the format. */
const SCENARIO_COLUMNS = [
  { header: 'Test ID', key: 'id', width: 18 },
  { header: 'Page', key: 'page', width: 20 },
  { header: 'Type', key: 'pageKind', width: 11 },
  { header: 'Section', key: 'section', width: 18 },
  { header: 'Field', key: 'field', width: 20 },
  { header: 'Field type', key: 'fieldType', width: 12 },
  { header: 'Required', key: 'required', width: 10 },
  { header: 'Constraint', key: 'constraint', width: 24 },
  { header: 'Case', key: 'caseId', width: 22 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Precondition', key: 'precondition', width: 40 },
  { header: 'Test steps', key: 'stepsText', width: 62 },
  { header: 'Test data', key: 'testData', width: 34 },
  { header: 'Expected result', key: 'expected', width: 62 },
  { header: 'Actual result', key: 'actual', width: 62 },
  { header: 'Status', key: 'status', width: 15 },
  { header: 'Public page', key: 'publicPage', width: 34 },
  { header: 'Evidence (video)', key: 'evidence', width: 40 },
  { header: 'Tester notes', key: 'notes', width: 30 },
]

function styleHeader(sheet) {
  const row = sheet.getRow(1)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  row.alignment = { vertical: 'middle' }
  row.height = 24
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

function addSummary(book, { runId, reproduce, inventory, rows, ranPages }) {
  const s = summarise(rows)
  const sheet = book.addWorksheet('Summary')
  sheet.columns = [
    { header: 'Item', key: 'k', width: 42 },
    { header: 'Value', key: 'v', width: 92 },
  ]
  styleHeader(sheet)

  const verdict = s.fail > 0 ? 'FAIL' : s.notRun > 0 ? 'PASS WITH ABANDONED CASES' : 'PASS'
  const facts = [
    ['Run ID', runId],
    ['Verdict', verdict],
    ['Reproduce', reproduce],
    ['Pages discovered', `${inventory.pages.length}`],
    ['Pages executed by this run', `${ranPages}`],
    ['Fields discovered', `${inventory.pages.reduce((n, p) => n + p.fields.length, 0)}`],
    ['Rows in the matrix', `${s.total}`],
    ['Passed', `${s.pass}`],
    ['Failed', `${s.fail}`],
    ['Never ran (abandoned after an earlier failure in the same field)', `${s.notRun}`],
    ['Not executable (hidden field, or no case template for its type)', `${s.notExecuted}`],
    ['Saved but not found in the HTML served for /', `${s.notRendered}`],
    [
      'Figures read from',
      "Playwright's JSON report and the run's own case log, never console output",
    ],
    [
      'Environment',
      'Local next dev on port 3100, started by Playwright. Not safe against a shared database: every case writes.',
    ],
  ]
  for (const [k, v] of facts) sheet.addRow({ k, v })
  sheet.getColumn('v').alignment = { wrapText: true, vertical: 'top' }

  sheet.addRow({})
  const gapsHeader = sheet.addRow({ k: 'What this run does not cover', v: '' })
  gapsHeader.font = { bold: true }
  for (const line of coverageGaps(inventory)) sheet.addRow({ k: '', v: line })
  return sheet
}

/**
 * The gap list, in one place. It is written into the Summary sheet and again into
 * its own sheet, because the Test Scenarios sheet is meant to be filtered and a
 * caveat that only exists on a filtered row is a caveat that disappears.
 */
export function coverageGaps(inventory) {
  return [
    inventory.versions.length
      ? `Draft versus published: versions are enabled on ${inventory.versions.join(', ')}, and neither state is exercised.`
      : 'Draft versus published: nothing in this config enables versions, so there is no draft state to test.',
    inventory.roleFields.length
      ? `Per-role permissions: role fields found (${inventory.roleFields.join(', ')}), and no per-role case is run.`
      : 'Per-role permissions: the auth collection has no role or select field, so no field is permission-restricted.',
    inventory.locales.length > 1
      ? `Locales: ${inventory.locales.join(', ')} are configured and only the default is exercised.`
      : `Locales: only ${inventory.locales.join(', ')} is configured, so localization can neither be shown to work nor to fail.`,
    'Concurrent editors: one session at a time. Two editors saving the same field at once is not exercised.',
    'Unsaved-changes warnings: every case saves. Navigating away from a dirty form is not exercised.',
    `Uploads as uploads: upload fields select existing media rather than posting a file, so no type or size limit is exercised. Configured limits: ${
      inventory.uploads?.length
        ? inventory.uploads
            .map(
              (u) =>
                `${u.collection} (mimeTypes: ${u.mimeTypes ? u.mimeTypes.join(', ') : 'none'}, filesize: ${u.filesize ?? 'none'})`,
            )
            .join('; ')
        : 'no upload collection in this config'
    }.`,
    'Layout: a value can save, render, and still break the design. `bun run verify:design` is that check and it is not run here.',
    'Deployment: everything here runs against this machine. Nothing fetches the deployed site.',
  ]
}

function addScenarios(book, rows) {
  const sheet = book.addWorksheet('Test Scenarios')
  sheet.columns = SCENARIO_COLUMNS
  styleHeader(sheet)

  for (const r of rows) {
    const row = sheet.addRow({
      ...r,
      stepsText: r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      notes: '',
    })
    row.alignment = { wrapText: true, vertical: 'top' }
    const status = row.getCell('status')
    status.font = { bold: true }
    const fill = STATUS_FILL[r.status]
    if (fill) {
      status.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    }
    // A relative path, so the workbook keeps working when the whole evidence
    // directory is zipped and sent on. An absolute one would break on the first
    // machine that is not this one.
    if (r.evidence) {
      row.getCell('evidence').value = { text: r.evidence, hyperlink: r.evidence }
    }
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: sheet.rowCount, column: SCENARIO_COLUMNS.length },
  }
  return sheet
}

function addTraceability(book, inventory, rows) {
  const sheet = book.addWorksheet('Traceability')
  sheet.columns = [
    { header: 'Page', key: 'page', width: 22 },
    { header: 'Field', key: 'field', width: 24 },
    { header: 'Field type', key: 'type', width: 14 },
    { header: 'Required', key: 'required', width: 10 },
    { header: 'Cases in the matrix', key: 'cases', width: 18 },
    { header: 'Passed', key: 'pass', width: 10 },
    { header: 'Failed', key: 'fail', width: 10 },
    { header: 'Never ran', key: 'notRun', width: 12 },
    { header: 'Covered?', key: 'covered', width: 16 },
    { header: 'Why not', key: 'why', width: 70 },
  ]
  styleHeader(sheet)

  // Only the pages this run targeted. A field list for a page nobody ran is a
  // list of NOs that says nothing about the run; `Not Covered` names those pages.
  const ran = new Set(rows.map((r) => r.page))
  for (const p of inventory.pages.filter((x) => ran.has(x.page))) {
    for (const f of p.fields) {
      const mine = rows.filter((r) => r.page === p.page && r.field === f.name)
      const t = summarise(mine)
      const executed = t.pass + t.fail + t.notRun
      sheet.addRow({
        page: p.page,
        field: f.name,
        type: f.type,
        required: f.required ? 'Yes' : 'No',
        cases: f.cases?.length ?? 0,
        pass: t.pass,
        fail: t.fail,
        notRun: t.notRun,
        covered: executed === 0 ? 'NO' : t.fail ? 'PARTIAL' : 'YES',
        why: executed
          ? ''
          : f.hidden
            ? '`admin.hidden` is set: the panel renders no input, so a form-driven case cannot reach it.'
            : !f.cases?.length
              ? `No case template exists for a \`${f.type}\` field.`
              : 'The page was discovered but not executed by this run.',
      }).alignment = { wrapText: true, vertical: 'top' }
    }
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: 10 } }
  return sheet
}

function addNotCovered(book, inventory, rows) {
  const sheet = book.addWorksheet('Not Covered')
  sheet.columns = [
    { header: 'Kind', key: 'kind', width: 26 },
    { header: 'Subject', key: 'subject', width: 34 },
    { header: 'Why it is not covered', key: 'why', width: 96 },
  ]
  styleHeader(sheet)
  for (const line of coverageGaps(inventory)) {
    const [head, ...rest] = line.split(':')
    sheet.addRow({ kind: 'Run-wide gap', subject: head, why: rest.join(':').trim() }).alignment = {
      wrapText: true,
      vertical: 'top',
    }
  }
  // Derived from the rows rather than taken as another argument: the rows are
  // already scoped to the pages the run targeted, so they are the authority on
  // which pages these are. A second source could disagree with the sheet beside it.
  const ranPageNames = new Set(rows.map((r) => r.page))
  for (const page of inventory.pages.map((p) => p.page).filter((p) => !ranPageNames.has(p))) {
    sheet.addRow({
      kind: 'Page not run',
      subject: page,
      why: 'This invocation did not target the page. Its matrix is generated at <page>/field-matrix.md and no case was executed against it. Run `bun run cms:e2e --all` to cover the whole CMS.',
    }).alignment = { wrapText: true, vertical: 'top' }
  }
  for (const r of rows.filter((x) => x.status === STATUS.notExecuted)) {
    sheet.addRow({
      kind: 'Field not executed',
      subject: `${r.page}.${r.field}`,
      why: r.actual,
    }).alignment = { wrapText: true, vertical: 'top' }
  }
  for (const r of rows.filter((x) => x.publicPage.startsWith('NOT found'))) {
    sheet.addRow({
      kind: 'Saved but not rendered',
      subject: `${r.page}.${r.field} / ${r.caseId}`,
      why: 'The value saved and re-read from the database, but was not in the HTML served for /. Either no component renders that field, or it renders from something other than the CMS.',
    }).alignment = { wrapText: true, vertical: 'top' }
  }
  return sheet
}

/** Writes the workbook and returns the path it wrote. */
export async function writeWorkbook(file, { runId, reproduce, inventory, rows, ranPages }) {
  const book = new ExcelJS.Workbook()
  book.creator = 'cms-to-qa'
  // No `book.created`: left unset, exceljs writes no timestamp at all, which is
  // what makes the pack byte-for-byte diffable across runs with the same inputs.
  // Setting it to `new Date()` would defeat that for no reader who needs it —
  // the run ID on the Summary sheet is the timestamp that matters.
  addSummary(book, { runId, reproduce, inventory, rows, ranPages })
  addScenarios(book, rows)
  addTraceability(book, inventory, rows)
  addNotCovered(book, inventory, rows)
  await book.xlsx.writeFile(file)
  return file
}
