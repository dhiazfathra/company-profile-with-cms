# Reproducing this repository from a clean checkout

This is the walk-through for someone who has just cloned the repository and wants
the site running locally, and then wants a deployment that actually works. It is
ordered the way the work was actually done — three skills, run in sequence — and
each section says what that step produced, why it exists, and the exact commands.

Two things are worth knowing before the first command.

**Not every step is reproducible in CI, and one is not reproducible at all
without a visible browser.** Those steps are called out where they appear, with
the reason. Pretending a pipeline is fully automated when part of it needs a human
at a real Chrome window is the sort of quiet inaccuracy this repository's ADRs
keep objecting to.

**A local run needs no accounts, no secrets and no external services.**
`bun run dev` itself needs every variable left blank. `bun run seed` and the CMS
round-trip e2e test are the exception: they require `E2E_USER_EMAIL` and
`E2E_USER_PASSWORD` (the `.env.example` defaults are fine locally, and are not
secrets — see the file for why), and that test refuses to run rather than skip
when they are missing. Set them before step 2. The other variables only start
mattering at deployment, where the two traps live.

## 0. Install

```bash
git clone <this repo>
cd company-profile-with-cms
bun install                              # links apps/web and all three packages
cp apps/web/.env.example apps/web/.env   # then leave it as-is for local work
```

Bun is the package manager and script runner; Node 20.9.0+ is the runtime, and
the app is deliberately not run under the Bun runtime — [ADR-0006](decisions/0006-bun-as-package-manager.md)
explains why that distinction is the whole decision. Scripts are invoked as
`bun run <name>`, never bare `bun test`, which would run Bun's own test runner and
silently ignore the configured script.

Bun loads `apps/web/.env` automatically for `dev`, `gen:cms`, `seed` and the e2e
suite, so one file covers every command with no `dotenv` import anywhere.

### The environment variables, and where each one matters

| Variable                | Local                                          | Deployment                                                              |
| ----------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `PAYLOAD_SECRET`        | optional — falls back to a development default | **required**; the build throws without it                               |
| `DATABASE_URI`          | optional — defaults to `file:./payload.db`     | **required in practice**; the default builds green and loses every edit |
| `DATABASE_AUTH_TOKEN`   | unused with a `file:` path                     | required alongside a remote libSQL `DATABASE_URI`                       |
| `BLOB_READ_WRITE_TOKEN` | optional — uploads go to `apps/web/media/`     | **required**; the build throws without it                               |
| `E2E_USER_EMAIL`        | needed by `seed` and the round-trip e2e test   | not needed by the app; a repository variable for CI                     |
| `E2E_USER_PASSWORD`     | same                                           | same                                                                    |
| `NEXT_DIST_DIR`         | optional convenience                           | unused                                                                  |

Three of these are fail-closed on purpose and must not be worked around:

- `PAYLOAD_SECRET` throws in production rather than fall back to the development
  value committed in this public repository ([ADR-0013](decisions/0013-deployment-configuration.md)).
- `BLOB_READ_WRITE_TOKEN` throws in production rather than write uploads to a
  filesystem a serverless deployment does not keep ([ADR-0014](decisions/0014-media-on-blob-storage.md)).
- `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` make the CMS round-trip test **fail**
  rather than skip when absent. A proof that silently stops running is worse than
  no proof.

`DATABASE_URI` is the one that does not fail closed, which is exactly why it is
the dangerous one — see step 3.

`NEXT_DIST_DIR` exists only so a second, throwaway `next dev` can build into its
own directory instead of contending over `.next/` with the main dev server. Leave
it unset normally.

## 1. figma-to-site — the design becomes sections and reference images

[`packages/figma-to-site/SKILL.md`](../packages/figma-to-site/SKILL.md)

This step turned a Figma file into `apps/web/site.manifest.json`, the section
components generated from it, the assets under `apps/web/public/`, and one
reference PNG per section under `apps/web/design/refs/`. Its rule is **verify the
render, not the diff**: it exists because a hero section shipped as a green band
nested inside another green band while the manifest validated, the unit tests
passed and the build succeeded.

**The Figma source of truth is one file.**
[`apps/web/design/figma.targets.json`](../apps/web/design/figma.targets.json)
holds `fileKey` (`v7ZzmwgTae9hxdKdNdAe7V`), `fileName`
(`Modern-Product-Launch`), and the 12 per-section entries with their node ids and
declared design sizes. That file is the only place any consumer reads a Figma
coordinate from, and
[`packages/figma-to-site/src/capture.mjs:128`](../packages/figma-to-site/src/capture.mjs)
is the only place a Figma URL is constructed. The key appears elsewhere in the
tree — in `packages/figma-to-site/evals/`, in `apps/web/TOKEN-GAPS.md`, in a
comment in `apps/web/app/globals.css` — and those occurrences are deliberately
_not_ shared with the config: an eval fixture that imported the app's live
capture config would stop testing the skill and start testing this repository's
current state, and prose is prose.

The `w`/`h` numbers in that file are load-bearing rather than documentation. The
crop scores candidate selection outlines by how close they are to the declared
size and takes the best match, so a wrong number does not fail — it returns a
different region of canvas and ships it. Two entries once carried a size that was
not their node's, and both shipped. Read those numbers off a Figma size badge,
never off how a downscaled reference PNG looks.

**Re-capturing is local-only, and cannot be a CI step.**

```bash
bun run capture:figma        # opens a real, visible Chrome window
```

Figma's CDN returns 403 to headless Chromium, so the capture launches a real
Chrome channel with `headless: false` ([ADR-0007](decisions/0007-figma-capture-by-screenshot.md)).
That is why `apps/web/design/refs/*.png` and `apps/web/public/img/*` are
**committed artifacts**: a clean checkout has the design references without ever
touching Figma, and CI runs the _verification_ rather than the capture. Raw canvas
grabs are kept in `apps/web/design/captures/` so a crop can be redone offline.

What a clean checkout can run is the check:

```bash
bun run validate:manifest    # site.manifest.json against its schema
bun run verify:design        # compares the running page against design/refs — needs a dev server
```

## 2. site-to-cms — the flat JSON becomes Payload

[`packages/site-to-cms/SKILL.md`](../packages/site-to-cms/SKILL.md)

This step moved the content out of `apps/web/content/*.json` and into Payload,
without a copy rework, by generating the CMS config from the same manifest the
components came from. Its rule is **prove the seam, not the render**: the
migration it came from finished with a clean build and a green suite that would
have been just as green with the CMS not connected at all, because the seed wrote
into Payload exactly the strings the components had hardcoded.

From a clean checkout:

```bash
bun run --cwd apps/web gen:cms   # payload.config.ts from site.manifest.json
bun run --cwd apps/web seed      # content/*.json -> Payload; upserts, safe to re-run
bun run dev                      # site on :3000, admin on :3000/admin
```

`payload.config.ts` is generated and never hand-edited;
`bun run --cwd apps/web check:cms-drift` fails if it has drifted from the
manifest. `seed` also creates the editor account from `E2E_USER_EMAIL` /
`E2E_USER_PASSWORD`, which is why those two need values in `.env` before you run
it. `seed` uploads each `public/`-relative image path into the `media`
collection, keyed on the full path so a re-run reuses the existing row instead of
piling up duplicates. Locally those files land in `apps/web/media/`, which is
gitignored — correct here, and the subject of step 3's second trap.

Then the checks:

```bash
bun run test    # unit suites: apps/web and all three packages
bun run lint
bun run e2e     # Playwright, including one design-fidelity test per section
```

Counts, run individually: 52 in `apps/web`, 95 in `packages/figma-to-site`, 57 in
`packages/site-to-cms` and 26 in `packages/deploy-to-vercel` — 230 across the
tree. The production guard added in
[ADR-0014](decisions/0014-media-on-blob-storage.md) briefly left one case in
`apps/web/tests/payload-secret.test.ts` red, because that case stubs
`NODE_ENV=production` and the new guard fired before its assertion; its fixture
now stubs `BLOB_READ_WRITE_TOKEN` too.

`bun run e2e` includes `apps/web/e2e/cms-round-trip.spec.ts`, which is the seam
proof: it signs into `/admin`, writes a value that exists nowhere in the
repository, and requires it in the server's HTML. It was verified in the failing
direction — hardcode the headline back into the component and it goes red.

## 3. deploy-to-vercel — Vercel plus a hosted database and a blob store

[`packages/deploy-to-vercel/SKILL.md`](../packages/deploy-to-vercel/SKILL.md)

That skill is the authority on the sequence and on the credential handling; read
it rather than this section if you are actually deploying. What follows is the
shape, and the two failures it was written from.

You authenticate the CLIs yourself, in a real browser — an agent driving this
should never see the credential that authenticated it:

```bash
npm i -g vercel && vercel login
brew install tursodatabase/tap/turso && turso auth login
vercel whoami && turso auth whoami
vercel link
```

**Trap one: sqlite does not survive serverless.** `DATABASE_URI` defaults to
`file:./payload.db`. On a serverless host the filesystem is read-only outside a
per-invocation `/tmp`, so an editor's save either errors or vanishes with the
invocation — and the build is green either way, because nothing in a build writes
to the database. Provision a hosted libSQL database, seed it from your machine,
and confirm the tables are non-empty by querying rather than by reading an exit
code. A freshly created Turso database has zero tables, and a deployment pointed
at it will build, boot, and serve an admin panel that can neither read nor write.

**Trap two: uploaded files do not survive serverless either.** This is the one
that shipped. Payload's `media` collection wrote to `apps/web/media/` on local
disk; the database is remote, so the media _rows_ survived every deploy while the
_files_ stayed on the machine that ran the seed, and every image on the deployed
homepage returned 500 from `/api/media/file/…` behind a green build. Create a
Vercel Blob store, link it to the project so Vercel injects
`BLOB_READ_WRITE_TOKEN` into its builds, then **clear the media collection and
seed it again** — setting the token does not backfill rows that point at files
which were never on the host:

```bash
bun run --cwd apps/web reset-media    # refuses without a real blob token
bun run --cwd apps/web seed
```

A plain reseed is not enough, and deleting only the visible duplicates is not
enough either. `uploadImage` finds a row by `sourcePath` and reuses it, so any
surviving pre-blob row is silently kept — exactly the row that has no file
behind it. With duplicates present the choice is not even deterministic: the
lookup takes the first match without a defined order, so a section can bind to
whichever duplicate the query happens to return. `reset-media` deletes all of
them so the seed recreates every row through the current adapter.
[ADR-0014](decisions/0014-media-on-blob-storage.md) has the full account.

Set every variable `apps/web/.env.example` documents, pipe secret values in from
a file rather than typing them, then deploy and verify the running app rather than
the build log:

```bash
vercel env ls
vercel env add DATABASE_AUTH_TOKEN production --sensitive < "$token_file"
vercel deploy --prod
```

Setting these in GitHub does not configure Vercel. Actions and Vercel read from
separate stores, and CI's `PAYLOAD_SECRET` is deliberately a different value from
production's.

## Verify you got it right

Local, with `bun run dev` running:

- `http://localhost:3000/` returns 200 and renders the sections.
- `http://localhost:3000/admin` returns 200 and you can sign in with the seeded
  editor account.
- Every `<img>` src on the homepage resolves **200, not 500**. These are
  `/api/media/file/<name>` routes served by Payload out of the media collection,
  not static files, so a 500 here is the ADR-0014 failure and not a typo.
- `bun run test` runs the four unit suites — 230 across the tree — and
  `bun run lint` is clean.
- `bun run e2e` passes, including the CMS round trip and one fidelity comparison
  per section.

On a deployment, do not check these by hand — `bun run parity-report` asks all
three sources the same questions and writes `parity-report/report.html` with the
design reference, the local render and the deployed render of each section beside
one another. It exits non-zero when they disagree, and
`.github/workflows/parity.yml` runs it against a deployment URL. A 200 on `/` is
necessary and not sufficient: the page renders from rows, and rows exist whether
or not the bytes behind them do.

**Point it at the production URL, not a preview URL.** Preview deployments have
Vercel deployment protection on, so a preview URL answers `302` to a login page
that itself returns 200. The report says so in a banner and refuses to grade the
sections rather than reporting eleven missing ones
([ADR-0015](decisions/0015-a-checker-must-prove-it-checked-the-right-thing.md)),
but the run still tells you nothing about the deployment. The CI workflow is
already scoped to production `deployment_status` events for this reason.

Sensitive production variables (`DATABASE_URI`, `DATABASE_AUTH_TOKEN`,
`PAYLOAD_SECRET`, `BLOB_READ_WRITE_TOKEN`) are flagged Sensitive on the Vercel
project, so `vercel env pull` returns `[SENSITIVE]` for them rather than the
value. That is deliberate: only the account owner's own shell, authenticated
interactively, can run a script against production data. A process handed
`[SENSITIVE]` fails with `Invalid token format for Vercel Blob adapter`, which is
the expected symptom, not a bug to work around.

Before opening a pull request, `bun run evidence` runs every gate and writes the
block to append to the description — see [ADR-0011](decisions/0011-evidence-pack-on-every-pr.md)
and the root `AGENTS.md`. It refuses to write anything if a gate fails, so it is
also the fastest way to find out whether the tree is actually in the state you
think it is.
