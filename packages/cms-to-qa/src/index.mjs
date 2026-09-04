/**
 * Turns a CMS field-matrix run into the three artefacts a manual tester needs:
 * a scenario workbook, a watchable report, and the row set both are built from.
 *
 * The runner is `scripts/cms-e2e.mjs` in the consuming repository. It owns the
 * browser, the database and the file layout; this package owns only the shapes,
 * which is why the shapes are the part with tests.
 */
export {
  STATUS,
  buildScenarios,
  caseSteps,
  describeValue,
  expectedResult,
  pagesNotRun,
  scenariosForPage,
  summarise,
  testId,
} from './scenarios.mjs'
export { esc, renderReport } from './report-html.mjs'
export { coverageGaps, writeWorkbook } from './workbook.mjs'
