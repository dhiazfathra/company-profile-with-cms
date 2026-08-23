---
name: cms-to-qa
description: Test every field of a Payload CMS through its admin panel and produce the SIT evidence a manual QA tester signs off — an HTML walkthrough with a recording per case, an Excel test-scenario workbook, and one video per case. Use for "cms e2e", "test every CMS field", "field matrix", "SIT evidence", "test scenarios for QA", "UAT sign-off pack", "does this field reach the public page", "cms edge cases", or before shipping a change to site.manifest.json, payload.config.ts, or a section component. Not for unit tests, component tests, design fidelity, or a plain `bun run e2e`.
---

# CMS to QA

## Overview

The fourth skill in this repository, and the one that produces something for
somebody else to read. [`figma-to-site`](../figma-to-site/SKILL.md) gets a design
onto a page and proves the render matches;
[`site-to-cms`](../site-to-cms/SKILL.md) moves that page's content into a CMS and
proves the page reads from it — for **one field**, which is all a seam needs to be
proven real; [`deploy-to-vercel`](../deploy-to-vercel/SKILL.md) gets it live and
verifies the deployment rather than the build. This one is what you hand a human
before a release.

Two failures live in the gap between "the seam works" and "the CMS is fine":

> **A field an editor can save that never reaches the page.** It fails invisibly
> and identically to success, because nothing renders it and nothing complains.
> The round trip cannot see it: it only ever looks at the one field it edits.

<!-- -->

> **A tick in a table is not evidence.** A tester asked to sign SIT off before UAT
> cannot verify a green check mark. They need to watch the value being typed into
> the panel and the panel accepting or refusing it, and they need the scenario in a
> form they can repeat by hand.

So the rule here is not about the test, it is about what the test leaves behind:

> **Discover the fields, then hand over what a human can check.** The field list
> comes from the running config, never from a list anyone wrote
> ([ADR-0018](../../docs/decisions/0018-the-field-matrix-is-discovered-not-written.md)).
> The run leaves an HTML walkthrough, a scenario workbook and one recording per
> case ([ADR-0019](../../docs/decisions/0019-sit-evidence-a-tester-can-check.md)).

## Prerequisites

Without all four, stop and say which one is missing — do not run a partial pass
and report it as a run.

| Need                                                                         | Check                                                                                                                                 | If missing                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Dependencies installed                                                       | `ls apps/web/node_modules/payload`                                                                                                    | `bun install`                            |
| `apps/web/.env` with `PAYLOAD_SECRET`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` | `grep -q '^PAYLOAD_SECRET=' apps/web/.env && grep -q '^E2E_USER_EMAIL=' apps/web/.env && grep -q '^E2E_USER_PASSWORD=' apps/web/.env` | copy `apps/web/.env.example`, fill it in |
| A seeded database whose editor account matches those credentials             | `ls apps/web/payload.db`                                                                                                              | `bun run --cwd apps/web seed`            |
| Playwright browsers                                                          | `bunx playwright install chromium`                                                                                                    | run it                                   |

Runs against **local** `next dev` on port 3100, started by Playwright's
`webServer`. Not safe against a shared staging database: every case writes to the
row it is testing. Restores are per field and best-effort — a crashed run leaves
the last case's value behind, and `bun run --cwd apps/web seed` puts it back.

If the credentials in `.env` and the seeded editor account disagree, every case
fails on the login step and the report says nothing about any field. Reseed
first; the suite's own restore guard will tell you to.

## Workflow

### 1. Discover. Never assume the page list.

```bash
bun run cms:e2e --discover-only
```

Imports `apps/web/payload.config.ts` — the config the running panel uses — and
probes each field's own validator with a bad value to learn what it rejects,
because Payload's sanitized config attaches a `validate` function to every field
and "has a validator" therefore means nothing.

Read `inventory.json` before testing. Two things in it change what is worth
running: `versions` (empty means drafts do not exist) and `roleFields` (empty
means no field is role-restricted).

### 2. Run.

```bash
bun run cms:e2e Header      # one page, 1–3 minutes
bun run cms:e2e --all       # every discovered page, roughly half an hour
```

Run from the **repository root**. `bun run` does not resolve a root script from
inside a workspace, so this fails with "Script not found" in `apps/web`;
`bun scripts/cms-e2e.mjs <Page>` works from anywhere.

Start with the page the change touched. `--all` is for a release gate, not a loop.

### 3. Read the report, not the exit code.

`report.html` at the run root is the whole run. `<page>/report.md` is the same
page's result in the form a pull request quotes. Four sections carry what a pass
does not:

- **Saved, but not observed on the public page** — the field round-tripped through
  the database and did not appear in the HTML served for `/`. Either no component
  renders it or it renders from something else. Investigate every entry; this is
  the bug class the skill was built for, and it does not fail a case.
- **Cases that never ran** — a failure abandons the rest of that field's cases,
  because each starts from the value the last left behind. Neither passed nor
  failed.
- **Fields with a template that logged no case** — cases were generated and none
  completed, so the field's first one failed. Distinct from **fields with no case
  template**, which is a field type the checklist does not cover, and from
  **fields hidden from the admin form**, which have no input to drive.
- **Pages not run by this invocation** — a single-page run is evidence about one
  page. The others are named so a reader cannot mistake the bundle for the CMS.

### 4. Hand it to the tester.

The three artefacts exist for this step, and none of them is the exit code.

| Artefact               | What the tester does with it                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `report.html`          | Opens it and **watches** the cases they doubt. One recording per case, beside the value typed and the outcome observed.     |
| `test-scenarios.xlsx`  | Filters to failures, reads the numbered steps, repeats one by hand, writes in the **Tester notes** column, signs the sheet. |
| `<page>/videos/*.webm` | The recordings themselves, named `<field>--<case>.webm`. The SIT artefact to attach to a release ticket.                    |

The workbook's four sheets, in the order a tester reads them:

- **Summary** — the verdict, every figure, and the gap list.
- **Test Scenarios** — one row per case: precondition, numbered steps, test data,
  expected result, actual result, status, whether it reached the public page, and a
  link to its recording. Filterable and frozen at the header.
- **Traceability** — one row per field: how many cases, how many passed, and
  `YES` / `PARTIAL` / `NO` on whether it is covered at all, with the reason when
  it is not.
- **Not Covered** — the gaps restated, because the Test Scenarios sheet is meant
  to be filtered and a caveat that only exists on a filtered row disappears.

A run that reaches UAT is one where every row is `PASS`, and every `NOT EXECUTED`
row has been read and accepted rather than skipped past.

### 5. Attach it to the pull request.

Append the page's `report.md` under the `bun run evidence` block that AGENTS.md
requires. Append — never overwrite what is there. `test-evidence/` is gitignored:
regenerate the pack, never commit it.

## The per-field checklist

Applied to every field the inventory finds, derived from the field's discovered
shape rather than from a list per page — so a field added to
`site.manifest.json` tomorrow is covered without editing anything. Source:
`casesFor()` in `apps/web/scripts/cms-discover.ts`.

| Case                               | Kind      | Asserts                                                                         |
| ---------------------------------- | --------- | ------------------------------------------------------------------------------- |
| `happy`                            | happy     | saves, re-reads identical, appears in the HTML served for `/`                   |
| `empty`                            | boundary  | required refuses it; optional saves it. Applies to text and to numbers alike    |
| `whitespace`                       | boundary  | not coerced to empty or trimmed; a format-validated field must refuse it        |
| `unicode`                          | boundary  | accents, CJK and astral-plane characters round-trip byte-for-byte               |
| `special`                          | boundary  | `& " ' < > \ %` round-trip, and are escaped rather than raw in the HTML         |
| `long`                             | boundary  | 5000 characters save whole — never truncated, never refused                     |
| `injection`                        | injection | stored verbatim, rendered as data: no `script` or `img[onerror]` in the section |
| `format-bad`                       | negative  | refused, with the validator's own message                                       |
| `format-anchor`, `format-absolute` | happy     | the accepted shapes save                                                        |
| `format-protocol-relative`         | boundary  | characterizes a known gap (limitation 1)                                        |
| `zero`, `negative`                 | boundary  | numbers: zero is not dropped as falsy, no lower bound is invented               |

Every accepted case also asserts **persistence in both halves**: the value
re-read from the database after a reload, and the value in the HTML the server
sent for `/` — fetched from a cookie-less context, because a value only an
authenticated user can see is not evidence about the public page. Every refused
case asserts the database did **not** change: a 4xx that half-wrote is worse than
either outcome alone.

## Evidence layout

```text
apps/web/test-evidence/<run-id>/
  report.html                  the whole run, with a player per case
  test-scenarios.xlsx          Summary · Test Scenarios · Traceability · Not Covered
  rollup.md                    per-page verdict, and which pages were not run
  inventory.json               every page and field, with probed constraints and every case
  <Page>/
    field-matrix.md            every case for every field, with its rationale
    report.md                  the page's verdict and the honest sections
    videos/<field>--<case>.webm  one recording per executed case
    logs/results.json          Playwright's JSON report — where the figures come from
    logs/cases.jsonl           one line per case as it completed
    traces/                    screenshot and trace zip, on failure only
```

One row set feeds `report.html`, the workbook and the counts. Three artefacts
built separately from the same logs is how three artefacts start disagreeing
about one run.

## Failure-handling policy

- **No skips.** A missing environment variable throws with the command that sets
  it. A skipped test renders as a row nobody ran, which reads like coverage.
- **No retries** on this project, unlike the rest of the suite. A case that passes
  on the second attempt is a case the pack cannot report honestly.
- **A failed page still gets a report**, and the rollup exits non-zero. A bundle
  with nine reports out of ten looks complete.
- **Every figure is read from `results.json` and `cases.jsonl`**, never from
  terminal output. Do not hand-edit a number into a report; rerun it.
- **Video is recorded on a pass, only in this project.** The rest of the suite
  keeps `retain-on-failure` because a video per passing test is disk nobody reads.
  Here the passing recording _is_ the deliverable, and `retain-on-failure`
  discards exactly it.
- **A row is never omitted to make the sheet tidy.** A field that cannot be
  executed gets a row saying so. A page that was not run gets named. The
  denominator is the whole matrix for what was targeted.
- **When a case fails, decide which side is wrong before touching either.** Three
  of the failures found while building this were the generator's expectation, not
  the CMS: whitespace on a URL field is correctly refused; a rejected save
  correctly leaves the _previous_ case's value in place, not the field's original;
  and a `beforeAll` login failure is reported by Playwright against the first
  test, which looks like a failing case and is a broken database. Read the
  assertion message first.

## Known limitations

Real, verified against this config — not hedging:

1. **Protocol-relative URLs pass.** Every `href` validator is
   `/^(\/|#|https?:\/\/)/`, so `//example.com` matches the `/` branch and saves as
   a "relative path". `format-protocol-relative` characterizes this rather than
   asserting the behaviour anyone wants; tighten the regex in `site-to-cms`'s
   generator and the case fails, which is the point.
2. **No draft/publish.** No global or collection sets `versions`. There is no
   draft state to test until one does.
3. **No roles.** The `users` collection has no role or select field, so no field is
   permission-restricted.
4. **One locale.** `localization.locales` is `['en']`. Fields are marked
   `localized` and there is one value each, so localization can neither be shown to
   work nor to fail.
5. **No concurrent-edit coverage.** One session at a time.
6. **No unsaved-changes coverage.** Every case saves.
7. **Uploads are not exercised as uploads.** `upload` fields select existing media
   rather than posting a file, so type and size limits have nothing to assert
   against. The configured limits are read from the config and printed, not
   claimed.
8. **Fields with `admin.hidden` are not covered.** The panel renders no input —
   `_seedIndex` on every collection is the generator's row identity — so a
   form-driven case fails on a missing locator and says nothing about the CMS.
   They get a `NOT EXECUTED` row rather than silence.
9. **The recording shows the panel, not the public page.** A case's video is the
   admin journey. Whether the value reached `/` is asserted from the served HTML
   and reported in the row, not filmed.
10. **The workbook is checked by reading it back, not by opening Excel.** Nothing
    here proves Excel accepts the file; that is why it is written with a library
    rather than hand-rolled XML.
11. **Layout is out of scope.** A value can save, render, and still break the
    design. `bun run verify:design` is that check.
12. **Local only.** Nothing fetches the deployment. `bun run parity-report` is the
    check that asks the deployed site.

## Page list, as discovered

Do not trust this list — run `--discover-only` and read the inventory. It is
recorded here so a change in it is visible.

- **Globals (11):** Navigation, Header, LogoCloud, Benefits, FeaturesCarousel,
  Specifications, Testimonial, HowItWorks, ShowcaseImage, CenteredCta, Footer
- **Collections (7):** NavigationItem, LogoCloudLogo, BenefitsItem,
  FeaturesCarouselItem, SpecificationsCell, HowItWorksStep, FooterLink
- **Excluded:** `users` and `media` (covered by `e2e/admin.spec.ts` and the media
  parity report), and Payload's own `payload-*` tables.

64 editable fields, 381 cases. A collection is tested through its first row.

## Files

| Path                                   | Role                                                            |
| -------------------------------------- | --------------------------------------------------------------- |
| `scripts/cms-e2e.mjs`                  | the runner: discovery, per-page run, reports, workbook, rollup  |
| `apps/web/scripts/cms-discover.ts`     | inventory, validator probing, the case checklist                |
| `apps/web/scripts/cms-discover-cli.ts` | CLI wrapper, kept separate so the spec can import the generator |
| `apps/web/e2e/cms-fields.spec.ts`      | the data-driven matrix                                          |
| `apps/web/playwright.config.ts`        | the `cms-fields` project, added only when `CMS_E2E_PAGE` is set |
| `src/scenarios.mjs`                    | the one row set all three artefacts render from                 |
| `src/report-html.mjs`                  | `report.html`                                                   |
| `src/workbook.mjs`                     | `test-scenarios.xlsx`                                           |
