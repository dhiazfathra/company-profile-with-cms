# ADR-0019: SIT evidence a tester can check, not a status a tester must trust

## Status

Accepted

## Date

2026-08-22

## Context

[ADR-0018](0018-the-field-matrix-is-discovered-not-written.md) made the field
matrix discovered rather than written, and `bun run cms:e2e <Page>` produced a
markdown report per page plus a rollup. That is the right artefact for a pull
request: a reviewer wants the figures, the command that produced them, and the
list of what the checks cannot see.

It is the wrong artefact for the next reader. A change to the CMS goes through
system integration testing before user acceptance testing, and the person doing
that is a manual tester, not the author of the diff. Handing them
`report.md` asks them to accept three things on trust:

- **That a green row happened.** They cannot re-derive it. The row says
  `happy (happy) — a valid value saves and reaches the public page`, and the only
  thing behind it is an exit code.
- **That the row list is the field list.** It was not. A field hidden from the
  admin panel produced no row at all, and a page nobody ran produced no row
  either — both indistinguishable, in the artefact, from "fine".
- **That they can repeat a case.** Nothing in the report said which value was
  typed into which field in which order, in terms a human could follow without
  reading `cms-fields.spec.ts`.

The failure mode this repository exists to prevent is a green check mark standing
in for a claim nobody made. Shipping a markdown table into a SIT gate reproduces
it one layer along: the tester signs, and what they signed is that a script
exited zero.

There was also a concrete gap. `bun run evidence` already produces an HTML pack
with each section's render beside its Figma reference, because the design check is
one a human can only accept by looking. The CMS matrix — 381 cases writing to a
database through a real admin panel — had no equivalent, despite being the harder
thing to believe.

## Decision

**One run, one row set, three artefacts a human can check.**

`bun run cms:e2e <Page>` and `--all` both now write, alongside the existing
markdown:

| Artefact               | What it answers                                                         |
| ---------------------- | ----------------------------------------------------------------------- |
| `report.html`          | "Show me." A player per case, beside the value typed and the outcome.   |
| `test-scenarios.xlsx`  | "Let me repeat one." Numbered steps, test data, expected, actual, sign. |
| `<page>/videos/*.webm` | The recordings, named `<field>--<case>.webm`, attachable to a ticket.   |

Four decisions inside that:

**1. Video is recorded on a pass, and only in this Playwright project.** The
suite's global `use` keeps `retain-on-failure`, for the reason already written
there: a video per passing test is a few hundred megabytes per run answering a
question nobody asks. Here the passing recording _is_ the question — a tester
verifying that a value was typed and accepted needs the run where it was — and
`retain-on-failure` discards exactly it. Scoped to the `cms-fields` project, which
only exists when `CMS_E2E_PAGE` is set, so no push pays for it.

**2. The three artefacts render from one row set.** `packages/cms-to-qa/src/scenarios.mjs`
turns the inventory and the run's logs into rows; the HTML, the workbook and the
counts all render from those. Building each from the raw logs separately is how
three artefacts start disagreeing about one run, and the disagreement would surface
as a tester finding a number in the workbook that the report contradicts.

**3. A row is never omitted to keep the sheet tidy.** A field that cannot be
executed — `admin.hidden`, or a type the checklist has no template for — gets a
row saying so and why. A page the invocation did not target gets named in its own
section and its own sheet. The denominator is the whole matrix for what was
targeted, which is the only denominator a coverage claim can honestly use.

**4. The workbook is written with `exceljs`, a new dependency.** See below.

The skill itself moves into the repository as `packages/cms-to-qa`, the fourth
workspace package alongside `figma-to-site`, `site-to-cms` and
`deploy-to-vercel` — same shape (`SKILL.md`, `README.md`, `src/`, `evals/`,
`tests/`), same place, and the pipeline now reads
Figma → site → CMS → QA. A skill that lives only on the machine that wrote it is
a skill the next contributor does not have.

## Alternatives considered

### Keep markdown only, and let the tester read the Playwright HTML report

- Pros: no new code, and Playwright's report already has traces and videos.
- Cons: it is organised by spec file and test title, not by field and case; it has
  no notion of "saved but not rendered", of a field that could not be executed, or
  of a page that was not run; and it cannot be filtered, annotated or signed. It
  answers "which test failed", which is the author's question, not "is this field
  correct", which is the tester's.
- Rejected: the artefact would need a reader who already knows the suite.

### CSV instead of a real workbook

- Pros: no dependency at all, a few lines of code, opens in Excel.
- Cons: one flat sheet, so Summary, Traceability and Not Covered would have to
  collapse into the scenario rows or be dropped — and Not Covered exists precisely
  because the scenario sheet gets filtered. No column widths, no wrapped
  multi-line steps, no frozen header, no autofilter, no hyperlink to a recording,
  nowhere to write a tester note that survives reopening.
- Rejected: the format cannot hold the artefact. A tester handed a 19-column CSV
  with embedded newlines in the steps column is handed a worse thing than the
  markdown.

### Hand-roll the `.xlsx`

- Pros: no dependency. A workbook is a zip of XML, and `node:zlib` has the
  deflate half of it.
- Cons: roughly 300 lines of ZIP central directory, CRC32 and SpreadsheetML
  before the first cell, and the cells here are the ones that break a naive
  writer: the `special` case carries `& " ' < >` at once, `unicode` carries
  astral-plane characters that are surrogate pairs in XML, and `long` is 5000
  characters. Getting any of that subtly wrong produces a file Excel offers to
  "repair" — an evidence artefact that lies about a run that was fine, discovered
  by the tester rather than by us.
- Rejected: this is the case the "never add a dependency for what a few lines can
  do" rule explicitly excludes, because a few lines cannot do it correctly. The
  precedent is `sharp`: the repository already takes a heavy dependency rather
  than hand-rolling a binary format. `exceljs` is `private`, dev-only, reaches no
  browser bundle, and is confined to `packages/cms-to-qa`.

### Stitch one video per page instead of one per case

- Pros: a single file to attach; a walkthrough that plays start to finish.
- Cons: needs `ffmpeg` (Playwright bundles one, but reaching into its internals is
  a private-API dependency), and a forty-minute reel is worse for the actual task.
  A tester doubting `Header.imageAlt / injection` wants that case, not to scrub
  for it.
- Rejected on usefulness before cost. The HTML report is the index that makes
  per-case files navigable, which is the job stitching would have been doing.

### Emit rows for every discovered page, always

This was the first implementation, and it was wrong in a way worth recording.
A single-page run produced 377 rows, of which 363 were other pages' matrices
marked `NOT EXECUTED` — the one real result was lost in them, and
`NOT EXECUTED` was doing two different jobs: "this field can never be driven
through the form" and "this invocation did not ask for this page". Now the rows
cover what ran and the unrun pages are named separately. Rejected because a
denominator that inflates coverage-shaped nothing is worse than a smaller honest
one.

## Consequences

- `--all` writes roughly 380 recordings, on the order of 40MB.
  `test-evidence/` is gitignored, so the pack is regenerated rather than
  committed, and a full run is a release-gate action rather than a loop.
- Recording adds wall clock to every case. Accepted: the run was already minutes
  per page and is not on the push path.
- `inventory.json` now carries every generated case, value included, replacing the
  `caseCount` scalar. It is larger, and it is the single source the report, the
  workbook and the HTML all describe cases from — a second, shorter description
  beside the value is one that can drift from what the browser types.
- The root `test` script gains a fourth workspace, and `scripts/cms-e2e.mjs`
  imports `cms-to-qa` as a workspace dependency. The pure shaping logic is
  therefore unit-tested (42 tests) where the runner previously had none.
- The stylesheet stays in `scripts/report-style.mjs` and is passed into the
  renderer. The package does not reach up into the repository for it, and the
  three HTML reports still share one copy — which is what that file exists for.
- What none of this proves: that Excel itself opens the workbook. The tests read
  it back with the same library that wrote it, which catches a value in the wrong
  column or a broken hyperlink but not a format dispute with Excel. That is the
  reason for the library rather than hand-rolled XML, and it is listed in the
  skill's limitations rather than left implied.
