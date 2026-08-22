# company-profile-with-cms (apps/web)

A pipeline that converts a Figma file into a live static site, then evolves it
into an admin-editable, CMS-backed, multi-language site — with no copy rework
between the two phases.

This is the site. The reusable Figma capture and design-fidelity tooling it
depends on lives in [`packages/figma-to-site`](../../packages/figma-to-site) —
see [ADR-0009](../../docs/decisions/0009-monorepo-with-figma-to-site-package.md)
for why they are separate. Commands below work from this directory; the repository
root delegates the same names.

**Status: Phase 2 deployed.** Payload CMS is wired in: `bun run
gen:cms` generates `payload.config.ts` from `site.manifest.json`, `bun run
seed` loads `content/*.json` into it, and `/admin` is live under `bun run dev`.
The site is no longer a static export — content is read from Payload at
request time (see "Adding a language" below for why).

Deployed URL: https://company-profile-with-cms-web.vercel.app/ — the Vercel
Blob store is provisioned and `BLOB_READ_WRITE_TOKEN` is set (PR #8's build
went green on it), and `apps/web/scripts/reset-media.ts` has been run once
against production: 18 media rows recreated through the adapter, with the same
18 files present in the blob store. Media on this deployment stays broken until
**PR #8 merges**, because the running build predates the adapter and still
resolves `/api/media/file/…` on local disk — verified 2026-08-22,
`/api/media/file/header-30.png` answers `500`. The rows already point where the
next deploy will look, so the merge is the whole remaining fix. Check the
production URL above, not a preview URL — preview deployments are protected and
serve a login page to anything unauthenticated. See
[docs/parity-gaps.md](../../docs/parity-gaps.md).

See [`TOKEN-GAPS.md`](TOKEN-GAPS.md) for design-token literals not bound to a
Figma variable.

## Environment variables

```bash
cp apps/web/.env.example apps/web/.env    # then fill in what you need
```

Bun loads `apps/web/.env` automatically for `bun run dev`, `gen:cms`, `seed` and
the e2e suite, so one file covers every command — no `dotenv` import and nothing
to pass inline. `.env` is gitignored; [`.env.example`](.env.example) is the
committed template and carries names and reasons, never values.

Locally you can leave every value blank and things work: the secret falls back to
a development default and the database falls back to a local sqlite file. The
table below is what changes when it is not local.

## Deploying

Four variables, and two of them are traps a green build says nothing about.
Rationale for the first two in
[ADR-0013](../../docs/decisions/0013-deployment-configuration.md); for the
third in [ADR-0014](../../docs/decisions/0014-media-on-blob-storage.md).

| Variable                | Required            | What happens without it                                                                                  |
| ----------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| `PAYLOAD_SECRET`        | **yes**             | The build fails: `PAYLOAD_SECRET must be set in production`                                              |
| `DATABASE_URI`          | **yes in practice** | The build **succeeds** and every editor save is lost — see below                                         |
| `DATABASE_AUTH_TOKEN`   | with a hosted DB    | A remote libSQL URL cannot authenticate                                                                  |
| `BLOB_READ_WRITE_TOKEN` | **yes**             | The build fails: without it, uploaded media would 500 in production — see [`.env.example`](.env.example) |

`PAYLOAD_SECRET` failing the build is deliberate, not a bug to work around:
`payload.config.ts` throws rather than fall back to its development secret when
`NODE_ENV` is production, so a deploy can never sign sessions with the value
committed in this public repository. Generate one per environment:

```bash
openssl rand -base64 32
```

**`DATABASE_URI` is the dangerous one.** It defaults to `file:./payload.db`,
which is right locally and cannot work on a serverless host: the filesystem is
read-only apart from a per-invocation `/tmp`, so a save either fails or vanishes
with the invocation. Nothing catches this — no build, test, lint or
design-fidelity check ever writes to the database, so a deployment on the default
looks entirely healthy while losing every edit.

Point it at a hosted libSQL database (Turso or equivalent — the same
`@payloadcms/db-sqlite` adapter, a remote URL) and set `DATABASE_AUTH_TOKEN`
alongside it:

```bash
DATABASE_URI=libsql://<your-db>.turso.io
DATABASE_AUTH_TOKEN=<token>
```

Then run `bun run seed` against it once, with `E2E_USER_EMAIL` /
`E2E_USER_PASSWORD` set, to create the schema and the first editor.

Setting these in GitHub does **not** configure the hosting provider — Actions and
Vercel read from separate stores. The repository's Actions secrets and variables
(`PAYLOAD_SECRET`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`) exist for CI only, and
CI's secret is deliberately a different value from production's.

## Running locally

```bash
bun install
bun run dev
```

- **Landing page:** http://localhost:3000
- **CMS admin:** http://localhost:3000/admin — sign up the first user on
  first visit. First-time setup:

  ```bash
  bun run gen:cms   # payload.config.ts from site.manifest.json
  bun run seed      # content/*.json -> Payload (upserts, safe to re-run)
  bun run dev       # /admin live
  ```

  Payload uses a local sqlite file (`payload.db`, gitignored) by default; set
  `DATABASE_URI` in `.env` to point elsewhere. Copy `.env.example` first if you
  have not — `bun run seed` needs `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` to create
  the editor account the round-trip test signs in as.

## How it works

A single reviewed artifact, `site.manifest.json`, describes every section and
field of the site. Three generators consume it — React section components, the
Phase 1 content seed, and the Phase 2 Payload config — so the content model is
never authored twice.

```
Figma ──extract──> site.manifest.json ──generate──> components
                    (human reviews)   ──generate──> content/*.json   (Phase 1)
                                      ──generate──> payload.config.ts (Phase 2)
```

**Phase 1** ships a static Next.js site with copy in `content/*.json`, keyed as
the CMS will key it (`headline_en`).
**Phase 2** generates the Payload schema, seeds it from those same files, and
flips `lib/content.ts` to read from Payload. No component changes.

## Commands

| Command                     | Description                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `bun install`               | Install dependencies                                                                                                               |
| `bun run dev`               | Start the development server                                                                                                       |
| `bun run build`             | Production build                                                                                                                   |
| `bun run test`              | Run unit tests (Vitest)                                                                                                            |
| `bun run e2e`               | Run end-to-end tests (Playwright) — starts the dev server itself                                                                   |
| `bun run e2e:report`        | Open the e2e HTML report (traces and videos for failures)                                                                          |
| `bun run lint`              | Run the linter                                                                                                                     |
| `bun run validate:manifest` | Validate `site.manifest.json` against the schema                                                                                   |
| `bun run verify:design`     | Compare the running page against the Figma references (needs a dev server)                                                         |
| `bun run capture:figma`     | Re-capture assets and references from Figma, per `design/figma.targets.json` — opens a real Chrome window                          |
| `bun run gen:cms`           | Generate `payload.config.ts` from `site.manifest.json`; refuses to run if a field's `translatable` flag changed since the last run |
| `bun run check:cms-drift`   | Fail (non-zero exit) if `payload.config.ts` is out of sync with `site.manifest.json` — run `gen:cms` and commit the result         |
| `bun run seed`              | Load `content/*.json` into Payload; upserts by position, safe to re-run                                                            |

## Testing

Unit tests cover the manifest schema and the content seam. End-to-end tests cover
the running app, the seam over real HTTP, and the validator CLI as a subprocess:

```bash
bunx playwright install chromium --with-deps   # once
bun run e2e
```

A failing e2e test records a video and a trace into `e2e-results/artifacts/`
(gitignored, `retain-on-failure` — a green run leaves it empty); the design
fidelity spec captures its section renders into `e2e-results/design/`
unconditionally, since those are the evidence a passing run has to show. CI
uploads the whole directory as a workflow artifact. Committed
evidence and reproduction details live in [`docs/e2e/README.md`](../../docs/e2e/README.md).

### Design fidelity

`e2e/design-fidelity.spec.ts` compares what the browser paints against
`design/refs/<Section>.png` — one test per section, so a failure names the
section and attaches the render next to the reference. `bun run verify:design`
runs the same comparison from the CLI against an already-running dev server,
which is the faster loop while changing a section.

It checks two things: the section's aspect ratio against the design size in
`design/refs/refs.json`, and a coarse block-colour comparison against the
reference image. It is deliberately not a pixel-diff — between a live browser
and a Figma raster, a pixel-diff is noise at any threshold that would still
catch a real defect. See
[ADR-0008](../../docs/decisions/0008-automated-design-fidelity-gate.md) for the
reasoning and the known limits, and
[`packages/figma-to-site/SKILL.md`](../../packages/figma-to-site/SKILL.md) for the
full workflow this site is one instance of.

The comparison itself, the capture pipeline, and the committed-asset scan all live
in `figma-to-site`. What belongs to this site is its data: which Figma nodes to
capture (`design/figma.targets.json`) and how far each reference is trusted
(`design/refs/refs.json`).

This check exists because Phase 1 shipped a hero section rendering a green band
inside a green band while every other gate was green. The manifest validated,
the unit tests passed, the build succeeded, and this very e2e suite screenshotted
the page at three viewports — and compared those screenshots to nothing.

`tests/sections.test.tsx`'s "never reads a locale-suffixed key" check is the
one to preserve: it asserts no component source contains a suffixed key,
which is what keeps the Phase 2 migration a backend swap rather than a
refactor. Locale-fallback behaviour itself — Payload's `fallbackLocale`
replacing Phase 1's `strip()` — is covered directly in
`tests/content.test.ts`, against a real (in-memory) Payload instance.

## Architecture

- **`site.manifest.json`** — source of truth for sections and fields. Reviewed by
  a human before any generator runs; this is the pipeline's only gate.
- **`lib/content.ts`** — the seam between phases. Both implementations return the
  same locale-resolved shape, so components never learn which backend is live.
- **`components/sections/*.tsx`** — one async, propless component per `global`
  section. Each fetches its own content through `lib/content.ts`; a `collection`
  section is data, read by the component of the section it belongs to, and gets
  no component of its own. `tests/sections.test.tsx` asserts that no copy is
  inlined in any component source, which is what keeps Phase 2 a backend swap.
- **`design/refs/`** — the design, as Figma renders it, one PNG per section plus
  `refs.json` recording each section's design size, where that number came from,
  and whether its PNG is trustworthy enough to compare content against. A
  reference has to be vouched for there before it can pass or fail a section: a
  corrupt reference is worse than a missing one, since it can do neither.
- **`content/*.json`** — the initial bootstrap seed for Payload (`bun run
seed`). Payload's database is now the sole authority for content and
  recovery is by database backup; these files stay in git only as the record
  of what was originally extracted from Figma, useful for re-seeding a fresh
  environment, never for restoring a live one.
- **`app/(frontend)/` and `app/(payload)/`** — two root layouts, and there must
  be no `app/layout.tsx` above them. Payload's admin renders its own `<html>`
  and `<body>`; a shared root layout wraps that in a second pair, and the panel
  then hydrates with nested `<html>` inside `<body>` while still _looking_
  correct. `e2e/admin.spec.ts` fails on exactly that, and was checked against
  the broken arrangement as well as the fixed one.
- **`payload.config.ts`** — generated by `bun run gen:cms` from
  `site.manifest.json`; never hand-edited (`bun run check:cms-drift` catches
  drift). `.payload-field-locales.json` is the generator's own snapshot of
  each field's `translatable` flag, used to refuse a silent flip.

Full design: [`docs/superpowers/specs/2026-08-21-figma-to-cms-pipeline-design.md`](../../docs/superpowers/specs/2026-08-21-figma-to-cms-pipeline-design.md)

## Decisions

| ADR                                                                         | Decision                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [0001](../../docs/decisions/0001-nextjs-payload-single-repo.md)             | Next.js + Payload in a single repository                                 |
| [0002](../../docs/decisions/0002-manifest-driven-generation.md)             | Generate components, content, and schema from one manifest               |
| [0003](../../docs/decisions/0003-token-and-section-rebuild.md)              | Rebuild Figma as semantic sections, not pixel-faithful codegen           |
| [0004](../../docs/decisions/0004-content-json-in-cms-shape.md)              | Phase 1 content stored in the CMS's shape                                |
| [0005](../../docs/decisions/0005-native-localization-suffix-interchange.md) | Payload native localization; `_en` suffix as interchange format          |
| [0006](../../docs/decisions/0006-bun-as-package-manager.md)                 | Bun as package manager and script runner; Node.js as the runtime         |
| [0007](../../docs/decisions/0007-figma-capture-by-screenshot.md)            | Capture Figma assets by cropping viewer screenshots, not MCP asset calls |
| [0008](../../docs/decisions/0008-automated-design-fidelity-gate.md)         | Automated two-axis design-fidelity gate instead of pixel-diff snapshots  |
| [0009](../../docs/decisions/0009-monorepo-with-figma-to-site-package.md)    | Monorepo, with the Figma pipeline as a reusable package                  |

## Adding a language

Append the locale to `locales` in `site.manifest.json`, run `bun run gen:cms`. No
migration, no new columns. Fields are empty until an editor fills them, and
Payload's fallback serves English in the meantime.
