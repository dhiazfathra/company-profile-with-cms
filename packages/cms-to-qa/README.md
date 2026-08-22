# cms-to-qa

Turn a CMS field-matrix run into the evidence pack a manual QA tester signs SIT
off with, and UAT starts from.

The skill is [`SKILL.md`](SKILL.md). This file is about the code.

## What is here

The runner lives in the consuming repository — `scripts/cms-e2e.mjs` — because it
owns the browser, the database and the file layout. This package owns the
**shapes**, which is why the shapes are the part with tests.

| Module                | Exports                                                                                                                              | Job                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `src/scenarios.mjs`   | `buildScenarios`, `scenariosForPage`, `summarise`, `pagesNotRun`, `describeValue`, `caseSteps`, `expectedResult`, `testId`, `STATUS` | One row per case, from the inventory and the run's own logs                |
| `src/report-html.mjs` | `renderReport`, `esc`                                                                                                                | `report.html` — the matrix with a player per case                          |
| `src/workbook.mjs`    | `writeWorkbook`, `coverageGaps`                                                                                                      | `test-scenarios.xlsx` — Summary, Test Scenarios, Traceability, Not Covered |

One row set, three artefacts. Three artefacts built separately from the same logs
is how three artefacts start disagreeing about one run, and the disagreement
surfaces as a tester finding a number in the workbook the report contradicts.

## The invariants the tests hold

`bun run test` — 42 unit tests, and these are the ones that matter:

- **A status is read, never decided.** A case Playwright reported as `skipped`
  (abandoned after an earlier failure in the same field) is `NOT RUN`, not a pass.
  Folding it either way misstates what the run observed.
- **Results are keyed per field, not per case id.** Every field has a `happy`
  case. Keyed on the case id alone, one field inherits another's result and the
  sheet reports a failure against the wrong field.
- **A field nothing could execute still gets a row.** `admin.hidden`, or a type
  with no case template, produces a `NOT EXECUTED` row with the reason. A field
  with no row reads as a field that was fine.
- **Rows cover the pages the run targeted; the rest are named.** Not the whole
  CMS — see the last section of
  [ADR-0019](../../docs/decisions/0019-sit-evidence-a-tester-can-check.md) for the
  version of this that was wrong.
- **Nothing emits raw markup.** The `injection` case's own value would otherwise
  execute inside the report that reports on it.
- **The workbook round-trips `& " ' < >` and 5000 characters.** Read back with the
  same library that wrote it, which catches a value in the wrong column, a status
  nobody coloured, or a hyperlink to a path that does not exist.

What no test here can prove is that Excel itself accepts the file. That is
precisely why `writeWorkbook` uses a library instead of hand-rolled XML, and it is
listed in the skill's limitations rather than left implied.

## Dependency

`exceljs`, and deliberately — the reasoning, the rejected alternatives (CSV, a
hand-rolled zip of SpreadsheetML) and the precedent are in
[ADR-0019](../../docs/decisions/0019-sit-evidence-a-tester-can-check.md). It is
`private`, dev-only, reaches no browser bundle, and is confined to this package.

## Usage

From the repository root, never from inside a workspace:

```bash
bun run cms:e2e --discover-only   # inventory and matrices, no browser
bun run cms:e2e Header            # one page
bun run cms:e2e --all             # every discovered page
```

Prerequisites and the evidence layout are in [`SKILL.md`](SKILL.md).
