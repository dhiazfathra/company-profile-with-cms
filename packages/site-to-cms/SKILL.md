---
name: site-to-cms
description: Put a built site's content behind a CMS and prove the page actually reads from it. Use when migrating hardcoded or JSON-file content into Payload/Strapi/Sanity, generating a CMS schema from a content manifest, adding a CMS admin panel to a Next.js app, deciding what becomes a global versus a collection, turning on localization, or writing a test that proves an editor's change reaches the public page.
---

# Site to CMS

## Overview

This is the second step. [`figma-to-site`](../figma-to-site/SKILL.md) gets a design
onto a page and proves the render matches; this one moves that page's content into
a CMS without breaking the proof, and adds the one check the first step cannot
make.

The trap here is different in kind. Design fidelity fails _visibly_ — a wrong
crop, a wrong shape, something a human notices by looking. A broken CMS seam fails
**invisibly and identically to success**: the page renders the right words either
way. Hence the central rule:

> **Prove the seam, not the render.** A page showing the correct copy is not
> evidence that it read that copy from the CMS. The only thing that can tell the
> two apart is a value that exists nowhere in the repository, written through the
> CMS, then required on the page.

A worked consumer lives at `apps/web` in this repository: `site.manifest.json`,
`schemas/manifest.ts`, `scripts/gen-cms.ts`, `.payload-field-locales.json`,
`e2e/cms-round-trip.spec.ts` — plus ADR-0001 (one repo), ADR-0002
(manifest-driven generation), ADR-0004 (content shaped for the CMS before the CMS
existed) and ADR-0005 (localization) under `docs/decisions/`.

## The motivating failure — read this before anything else

This one did not ship. It was one test away from shipping, which is worse to
discover, because everything that was supposed to catch it was green and had been
green all along.

Phase 1 built eleven sections with their copy in the components and a JSON file.
Phase 2 moved that copy into Payload: globals and collections generated from the
manifest, a seed script, `lib/content.ts` reading through Payload's local API.
The suite at the end of it: 131 unit tests, 23 e2e tests, eleven design-fidelity
comparisons, a locale-fallback check, a build, a lint. All green.

**Every single one of those would also have been green if the CMS were not
connected at all.** The seed writes into Payload exactly the strings Phase 1 had
baked into the components. So:

- "the headline is on the page" passes whether the page read it from Payload or
  from a string literal three lines above.
- the fidelity check compares a _render_ — same pixels either way.
- the locale-fallback check exercises `lib/content.ts`, and would keep passing
  with the components ignoring it.
- the build compiles; `payload.config.ts` is valid TypeScript whether or not
  anything imports it.

The migration's entire claim — _the CMS is now the source of the page_ — had no
check behind it. Not a weak check. None. And the reason is structural, not
carelessness: **the seed made the CMS and the hardcoded content agree, and then
every test compared one to the other.**

What closed it is one test, `e2e/cms-round-trip.spec.ts`: sign in to `/admin` as
an editor, read `Header.headline`'s current value out of the admin form, write
`CMS round trip ${Date.now()}` into it, save, and require that exact string on
the public page and in the server's own HTML. A hardcoded component cannot do
that. Nothing else in the suite can fail on it.

**The lesson.** When you migrate content, the old and new sources agree by
construction — that is what "migration" means. Every equality check you own is
therefore blind for the duration. The seam needs a value that belongs to neither
source.

**The follow-on lesson.** Having written that test, we then verified it in the
failing direction: put the hardcoded headline back into the component and confirm
the round trip fails. It did, reporting `Received: "Browse everything."`. Do this.
A seam test written against a working seam has never been observed to fail, and a
proof of the one thing your migration claims is exactly the wrong place to trust
that it would.

## Step 1 — Shape the content for the CMS before the CMS exists

Do this in step one, on the file-based content, before any CMS is installed. Give
the JSON the field names, the nesting and the singular/plural split you intend the
CMS to have (ADR-0004). Then the migration is a change of _reader_, not a change
of _shape_, and every existing test keeps its meaning across it.

Migrating shape and source in one move means every test that breaks has two
possible causes and you cannot tell which. Worse, the tests you then rewrite to
get green are the tests that were guarding the migration.

## Step 2 — Generate the schema from the manifest; never hand-write it

One file describes the content model (`site.manifest.json`): sections, their
fields, each field's type, whether it is translatable. A generator emits the CMS
config from it (`scripts/gen-cms.ts` → `payload.config.ts`), and CI regenerates
and diffs to prove the checked-in config still matches:

```yaml
- run: bun run --cwd apps/web gen:cms
- run: git diff --exit-code -- apps/web/payload.config.ts apps/web/.payload-field-locales.json
```

Two authorities for the content shape is the defect this prevents. Hand-edit the
CMS config once and the manifest becomes documentation — still read by the loader,
the validator and the seed script, all now describing a schema that no longer
exists.

**Validate the manifest at its one human gate, and reject there rather than
downstream.** `schemas/manifest.ts` refuses several things a generator would
otherwise happily emit:

- **A field type with no renderer.** `richText` is rejected. The generator would
  emit a valid Lexical field; `lib/content.ts` hands sections plain values and
  every section renders its fields as strings, so a Lexical node tree arrives
  where a string is expected. As a JSX child React throws — "Objects are not
  valid as a React child" — and in any string context (a template literal, an
  `alt`, a `title`, a meta tag) it becomes `[object Object]` instead. Nothing in
  the build objects either way, because at the boundary the value is `unknown`.
  Add the type back _together with_ its renderer, not before.
- **A locale suffix in a field name.** `headline_en` is a field whose name encodes
  what `translatable: true` is for. Two mechanisms for one fact, and the suffixed
  one leaks into rendered HTML (ADR-0005).
- **Duplicate names**, at both field and section level, since the generator would
  emit the last one and silently drop the rest.

The rule generalises past this repo: a generator turns a description into code, so
whatever the description permits, the code will contain. The validator is where a
human decides what the description may say.

## Step 3 — Decide global versus collection from cardinality, not convenience

A **global** is a thing there is exactly one of: the header, the footer, the
site's hero. A **collection** is a thing there are many of and whose order or
count an editor should control: nav items, testimonials, feature cards.

The tell is the editor's question. "Change the headline" is a global. "Add a
fourth benefit" is a collection — and if you modelled the benefits as
`benefit1Title`, `benefit2Title`, `benefit3Title` on a global, that request is now
a schema migration and a deploy instead of a click. Numbered fields on a global
are the standard way this goes wrong; they look tidy in the manifest and they hard-code
the count of something the design will change.

## Step 4 — Treat a localization flag as a migration, and guard it with a snapshot

Toggling `localized` on a field that already holds content can lose that content
(ADR-0005). It is a data migration wearing a boolean's clothing, and in a
manifest-driven pipeline it is one character to type.

So keep a snapshot of every field's flag beside the generated config
(`.payload-field-locales.json`), and make the generator **refuse** when a field
that exists in the snapshot changes its value:

```text
gen:cms refuses to change 'translatable' on existing field(s): Header.headline.
Toggling localization on an existing field can lose stored content (see ADR-0005)
— write a manual migration instead.
```

New fields are free; existing fields need a written migration. Commit the snapshot
and diff it in CI alongside the config, or the guard only fires on the machine
that happens to have the old copy.

## Step 5 — Prove the seam with a value that exists nowhere

The test the migration exists to justify. It must:

- **Write through the CMS the way an editor does.** Drive the admin UI, not the
  REST API. The API proves the same seam with less to go wrong — but a reviewer
  cannot check an API call, and the admin path additionally proves the admin panel
  renders, authenticates and saves. Sign in through the real login form; the
  cookie it sets is also what authorises the cleanup at the end, so nothing in the
  test has to handle a token.
- **Use a value no fixture contains.** `CMS round trip ${Date.now()}` — unique per
  run, so a cached render cannot pass for a fresh one and the string cannot exist
  anywhere in the repository.
- **Reload before believing the form.** Payload keeps the form mounted after a
  save, so the value in the input proves only that typing works. Reload and read
  it back from the database.
- **Wait for the save, not for the click.** `#action-save` fires a request; a
  reload that lands first reads the old row and reports a stale value as a broken
  seam. Await the response the click causes and assert its status — a 4xx there is
  a far clearer failure than a stale value three assertions later.
- **Check the server's HTML, not only the DOM.** `expect(await (await
page.request.get('/')).text()).toContain(edited)` — a DOM assertion alone can
  pass on something the client assembled.
- **Restore the original in a `finally`.** The test has to be re-runnable, and the
  design-fidelity comparison must not be handed a mutated headline.
- **Fail, never skip, when its credentials are absent.** A skip is a green tick.
  A round-trip proof that silently stops running is worse than not having one,
  because the suite still reports the same number of passes.

## Step 6 — Isolate the one test that writes

A seam test mutates state every other test reads. Under a parallel runner it will
change `Header.headline` while the fidelity check is comparing that section
against its reference — a different string is a different layout, so the
comparison fails for a reason that has nothing to do with fidelity, intermittently,
and on someone else's pull request.

Give it its own runner project that depends on the read-only one, so it starts
only once everything else has finished reading the seeded state:

```ts
projects: [
  { name: 'chromium', testIgnore: ROUND_TRIP },
  { name: 'round-trip', testMatch: ROUND_TRIP, dependencies: ['chromium'] },
]
```

Ordering, not `workers: 1`. Serialising the whole suite to protect one test pays
for the isolation across every other test in it.

## Step 7 — Mount the admin panel without breaking the public page

A CMS admin is a second application under the same origin. In Next.js App Router
that is two route groups with **a root layout each** — `app/(frontend)/layout.tsx`
and `app/(payload)/layout.tsx` — because the admin ships its own `<html>` and
`<body>`.

Get this wrong and it does not error; it _hydrates_ wrong. A shared root layout
around a panel that renders its own `<html>` gives you nested `<html>` elements,
which React reports as a hydration mismatch in the console and the browser
silently repairs. The page still works. Nobody looks at the console.

So assert it, rather than remembering it: one e2e test that loads `/admin` and
requires **exactly one** `<html>` element, and a check that the console is clean
on both the public page and the admin. A structural invariant nothing enforces is
a comment.

## Step 8 — A CMS-backed page is not a static export

If the site was a static export (`output: 'export'`), reading content from a
database at request time ends that. Drop the export mode deliberately and say so —
the two are mutually exclusive, not a setting to reconcile.

Then check the _observable_ consequence rather than remembering the change. A
report claiming "static export" for a build that no longer produces one is a lie
told by a hardcoded string, which is precisely what these gates exist to catch. A
static export writes `out/index.html`; a server build does not:

```js
const buildMode =
  existsSync(exportIndex) && statSync(exportIndex).mtimeMs >= buildStart
    ? 'static export'
    : 'server build, no static export'
```

The mtime comparison matters: an `out/` left behind by an earlier phase would
otherwise answer for this build.

## Step 9 — Fail closed on the CMS secret

A CMS needs a signing secret. Give it a development fallback if you like, but
**throw** when the environment is production:

```ts
secret: (() => {
  if (process.env.PAYLOAD_SECRET) return process.env.PAYLOAD_SECRET
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PAYLOAD_SECRET must be set in production')
  }
  return 'dev-secret-change-me'
})()
```

A silent fallback in production means every deployment signs sessions with a
value published in your repository. Failing closed converts that into a
deployment error, which is the cheapest possible place to find out.

The corollary is easy to miss: once the config throws in production mode, **every
script that triggers a production build needs the variable** — the CI build step,
and any local pipeline that shells out to one. Ours ran a production build for
months in an environment that happened not to set `NODE_ENV`, so the throw never
fired and the gap stayed invisible.

## Step 10 — Generated files belong to their generator

A CMS scaffolds files into your tree — Payload writes
`app/(payload)/admin/importMap.js`, the file it resolves every admin component
through at runtime. If your formatter and its generator disagree about quotes or
trailing commas, the file is unformatted the instant it is written, and
formatting it by hand only means the next regeneration un-formats it. A commit
gate then blocks every commit in the repository over a file nobody edited.

Add it to `.prettierignore` (or the equivalent). It is generated output; its
generator owns its style.

**Then find out what actually regenerates it, and do not assume the build
does.** This step used to claim Payload regenerates the import map on every
`next build` and `next dev`. It does not: `withPayload` never calls the
generator, only the `payload generate:importmap` CLI does, and the file is
committed. That one wrong sentence is why nobody suspected the map when the
deployed `/admin` went blank with

```text
getFromImportMap: PayloadComponent not found in importMap {
  key: '@payloadcms/storage-vercel-blob/client#VercelBlobClientUploadHandler', ... }
```

Two rules follow, and they generalise past Payload:

- **A generated artifact's content must not depend on the environment that
  generated it.** The config registered its blob-storage plugin only when
  `BLOB_READ_WRITE_TOKEN` was set, so the map generated on a laptop was missing
  a component production asked for. Register the thing unconditionally and turn
  it off with its own flag — `vercelBlobStorage({ enabled: Boolean(token),
token: token ?? '', ... })` keeps the component in the map and only disables
  the upload adapter. Any `process.env` read on the path from config to
  generated file is this bug waiting for a second environment.
- **Regenerate-and-diff in CI, like a lockfile.** A committed generated file
  with no drift gate is correct until someone forgets. Ours is
  `bun run --cwd apps/web check:importmap`, next to `check:cms-drift`, and it
  fails on any difference. If the vendor CLI cannot load your config (Payload's
  chokes on the top-level await in `@payloadcms/richtext-lexical` with
  `ERR_REQUIRE_ASYNC_MODULE`), call its generator directly from a runtime that
  loads ESM natively rather than skipping the gate.

The reason this cost a deployment rather than a build: the missing component is
a _runtime_ lookup in a client-rendered panel. The route still answers `200`,
the shell still carries a `<title>`, and the panel is blank. Nothing in
`next build` reads the import map at all.

**And a lesson about the diagnosis rather than the fix.** Faced with that gate,
we concluded the gate was broken — that the tool could not handle the parentheses
in a route-group path — and bypassed it with `--no-verify` four times, writing
that explanation into four commit messages. The theory was never tested. When it
finally was, the tool resolved the path correctly from both directories and
reported a real formatting violation both times; the "evidence" for the bug had
been a command run from the wrong working directory. **A tool reporting something
inconvenient is not evidence the tool is wrong.** Reproduce the claim, with the
exit code, from a directory you have confirmed, before you build a workaround —
and be much more suspicious than this when the workaround is to switch the check
off.

## Step 11 — Write down what the seam proof cannot see

The last honest step, for the same reason `figma-to-site` step 8 exists. From the
reference implementation:

- The round trip edits **one text field of one global in one locale**. It says
  nothing about uploads, collections, a second locale's fallback, or editor
  permissions beyond the single account it signs in as.
- It proves the seam is real. It does not prove every field is wired — a section
  could read one field from the CMS and hardcode the rest, and only the field
  under test would notice.
- Nothing checks what an editor sees when they save something invalid, or that
  required-field validation matches the manifest's.
- Nothing exercises concurrent edits, drafts, or publish states.

## Checklist

- [ ] Content shaped for the CMS while still in files — migration changes the
      reader, not the shape.
- [ ] One manifest describes the content model; the CMS config is generated from
      it and CI regenerates and diffs it.
- [ ] The manifest's validator rejects field types with no renderer, locale
      suffixes in names, and duplicates.
- [ ] Global versus collection decided by cardinality; no numbered fields
      standing in for a list.
- [ ] Localization flags snapshotted; the generator refuses to flip one on an
      existing field.
- [ ] A round-trip test writes a value no fixture contains, through the admin UI,
      and requires it on the public page and in the server's HTML.
- [ ] That test reloads before believing the form, waits for the save response,
      restores the original in a `finally`, and fails rather than skips without
      credentials.
- [ ] The round trip verified in the failing direction — hardcode the value back
      and confirm it fails.
- [ ] The mutating test isolated by runner ordering, not by serialising the suite.
- [ ] Admin panel in its own route group with its own root layout; exactly-one
      `<html>` asserted; console clean on both apps.
- [ ] Static export dropped deliberately if it was in use, and the build mode
      reported from an observation rather than a remembered string.
- [ ] CMS secret throws in production; every production-build path supplies it.
- [ ] Generator-owned files excluded from the formatter.
- [ ] Residual limits written down: one field, one global, one locale, one
      account; no uploads, drafts or permissions coverage.

## Red Flags and Rationalisations

| Rationalisation                                          | Reality                                                                                                                                                                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The page shows the CMS content, so the CMS is wired"    | It shows the _same_ content. The seed made both sources agree; every equality check is blind. Write a value that exists nowhere.                                                                                |
| "The suite is green after the migration"                 | 131 unit, 23 e2e and 11 fidelity checks were green while the migration had no check behind it at all. Green measured Phase 1, which still worked.                                                               |
| "The content-seam test covers the loader"                | It covers the loader. It does not check that any component calls it.                                                                                                                                            |
| "The round trip passes, so it works"                     | It has only seen a working seam. Hardcode the value back and confirm it fails, or you have tested nothing.                                                                                                      |
| "I'll edit the CMS config directly, it's faster"         | Then the manifest is documentation, and the loader, validator and seed all describe a schema that no longer exists. Regenerate and diff in CI.                                                                  |
| "The generator emits a valid field, so the type is fine" | Valid to the CMS, unrenderable by the site. `richText` arrives as a Lexical node tree: React throws on it as a JSX child, and any string context turns it into `[object Object]`. The build objects to neither. |
| "`headline_en` is clearer than a translatable flag"      | Two mechanisms for one fact, and the suffix leaks into rendered HTML. Pick the CMS's own localization.                                                                                                          |
| "Three benefits is three fields"                         | The first "add a fourth" turns a click into a schema migration and a deploy. Cardinality decides global versus collection.                                                                                      |
| "Flipping `localized` is a one-character change"         | It is a data migration that can lose stored content. Snapshot the flags and refuse the flip.                                                                                                                    |
| "The admin panel works, the console warning is cosmetic" | Nested `<html>` is a hydration mismatch the browser repairs silently. Assert exactly one, or it comes back.                                                                                                     |
| "The API call proves the round trip"                     | It proves the seam, and nothing about the panel an editor uses. Drive the admin UI; a reviewer can check that.                                                                                                  |
| "The form shows the new value after saving"              | The form shows what you typed. Reload and read it back from the database.                                                                                                                                       |
| "Reload right after clicking save"                       | The save is in flight; a reload that lands first reads the old row and blames the seam. Await the response.                                                                                                     |
| "Skip the round trip when credentials are missing"       | A skip is a green tick and the pass count does not move. Fail loudly.                                                                                                                                           |
| "One worker fixes the flake"                             | It also serialises every read-only test to protect one writer. Order the projects instead.                                                                                                                      |
| "The report says static export"                          | Does it? Read it off the filesystem. A hardcoded claim in an evidence pack is the defect the pack exists to prevent.                                                                                            |
| "The secret has a fallback, so deploys are fine"         | Then production signs sessions with a value in your repository. Throw, and supply it from every production-build path.                                                                                          |
| "The formatter is broken on generated files"             | Reproduce that, with an exit code, from a directory you have confirmed. Ours was a command run from the wrong cwd, and the workaround was four `--no-verify` commits.                                           |
| "Everything passes, so the CMS drives the site"          | One field of one global in one locale drives the site. Say so, or the next reader will believe more than you proved.                                                                                            |
