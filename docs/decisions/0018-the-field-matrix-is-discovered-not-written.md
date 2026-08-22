# ADR-0018: The CMS field matrix is discovered from the config, not written down

## Status

Accepted

## Date

2026-08-23

## Context

`e2e/cms-round-trip.spec.ts` proves the Phase 2 claim: an editor changes
`Header.headline` in the admin panel and the landing page follows. One field, one
happy path. Everything else about the CMS — 18 pages, 64 editable fields — is
covered by nothing at all, and the two questions an editor asks first are not
asked anywhere:

- Does the value I typed come back the way I typed it? (Unicode, quotes,
  5000 characters, whitespace.)
- Does it reach the public page?

A suite that answers those has to name the fields. Which raises the problem this
ADR is about: **`payload.config.ts` is generated.** It is produced from
`site.manifest.json` by `bun run gen:cms`, and sections are added and removed by
editing the manifest. Three ways to build a field matrix over a generated schema,
and two of them are worse than no matrix:

1. **Write the cases per field by hand.** Every field appears in three places —
   the manifest, the generated config, the test — and the test is the one that
   nobody updates. A field added tomorrow is silently uncovered: the suite stays
   green because it never heard of it. This is the failure mode AGENTS.md was
   written about, in a new costume.

2. **Generate the matrix from `site.manifest.json`.** Closer, and still wrong:
   the manifest is the generator's _input_. A matrix built from it agrees with
   the generator by construction, including when the generator is what is broken.
   The whole point of a test is to disagree with the thing it is testing.

3. **Discover it from the config the running panel loads.** The admin panel and
   the matrix then read the same object, and a mismatch between manifest and
   config is something the matrix can still catch.

A second problem sits underneath: what a field's _constraints are_ cannot be read
off the config either. Payload's `buildConfig` sanitizes what it is given and
attaches a `validate` function to every single field, so `typeof field.validate
=== 'function'` is true for a plain text field and for a URL field alike.
Checking for the presence of a validator distinguishes nothing.

## Decision

**Discover, then probe, then generate.**

`apps/web/scripts/cms-discover.ts` imports `apps/web/payload.config.ts` —
awaiting the same promise `next dev` awaits — and walks its globals and
collections. For every field it calls the field's own `validate` function with a
deliberately bad value and records _the message that comes back_. A field whose
validator returns a string for `"not a url at all"` is a format-constrained
field, and the string is the rule; a field that returns nothing is not. The
inventory therefore describes behaviour that was observed, not metadata that was
declared.

`casesFor(field)` then derives the case list from that discovered shape — happy,
empty, whitespace, unicode, special characters, 5000 characters, injection, and
the format cases when a format rule was found. `e2e/cms-fields.spec.ts` iterates
it. **No file in this repository contains a list of CMS field names for testing
purposes.** Adding a section to the manifest adds its cases.

Three decisions inside that, each of which cost a failing run to learn:

- **Persistence is asserted in both halves.** The value re-read from the database
  after a page reload, _and_ the value in the HTML the server sent for `/`. The
  second half is read from the HTTP response rather than the DOM, so a value the
  client assembled cannot pass for one the server rendered. It also allows for
  React's escaping — a value containing `&`, `<`, `"` or `'` is _correctly_
  absent from the HTML in raw form, and the first version of the check reported
  the special-characters case of every field as "not rendered".

- **A field that saves but never appears on the page is reported, not failed.**
  The run cannot distinguish "no component renders this" from "rendered from
  something other than the CMS", and guessing would either fail honest fields or
  hide broken ones. The report names them under its own heading.

- **The `cms-fields` Playwright project sets `retries: 0`**, against the
  suite-wide `retries: 1`. A case that passes on the second attempt is a case the
  evidence pack cannot report honestly.

## Consequences

- Running is per page and opt-in: `bun scripts/cms-e2e.mjs <Page>`. The project
  is _added to_ the Playwright config only when `CMS_E2E_PAGE` is set, rather
  than being skipped when it is not — a skipped test renders as a row nobody ran,
  which reads like coverage. `bun run e2e` is unchanged.
- Every case writes to the database, so the project runs serially and restores
  each field after its cases. It is unsafe against a shared database, and the
  skill says so.
- Evidence lands in `apps/web/test-evidence/<run-id>/<page>/` — gitignored,
  regenerated, with every figure read from Playwright's JSON report rather than
  its terminal output, for the reason ADR-0011 gives.
- The matrix inherits the CMS's blind spots and states them: no `versions`, so no
  draft/publish; no role field on `users`, so no per-role permissions; one
  locale, so localization cannot be shown to work. These are read from the
  inventory at report time, so if the config gains versions the report stops
  claiming they do not exist.
- The generated cases are only as good as `casesFor`. It has its own unit tests
  (`tests/cms-discover.test.ts`), including one that pins the whitespace rule for
  format-validated fields — the case where the first run's failure turned out to
  be the generator's mistake, not the CMS's.
- `upload` fields get no cases. `media` configures no `mimeTypes` or `filesize`
  limit and the fields select existing media rather than posting a file, so there
  is nothing to assert. They are listed as uncovered rather than omitted.

## Alternatives considered

### A hand-written matrix per page

Rejected above: the failure mode is silence, which is the one failure mode this
repository has already paid for once.

### Generate from `site.manifest.json`

Rejected above: a test that reads the generator's input cannot catch the
generator.

### Drive the REST API instead of the admin form

Faster and far less to go wrong — and it would prove the seam to a machine
rather than to a reviewer. The artefact a reviewer can check is the editor's own
journey: the form holding the value, the form holding it after a reload, the page
before and after. `cms-round-trip.spec.ts` made the same call for the same
reason.

### One test per field, looping the cases inside

Would cut the run time roughly in half. Rejected: the report would say
"`headline` failed" and send the reader to a trace. One test per (field, case)
means the failure names the case and its rationale in its own title.

### Fold "never ran" into pass or fail

A failure abandons the rest of that field's cases, because each case starts from
the value the last one left. Counting those as failures overstates the damage;
counting them as passes hides it. The report has three buckets.
