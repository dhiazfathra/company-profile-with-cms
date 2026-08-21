# company-profile-with-cms

A pipeline that converts a Figma file into a live static site, then evolves it
into an admin-editable, CMS-backed, multi-language site — with no copy rework
between the two phases.

**Status: Phase 1 complete; deploy pending.** The static site is built and
ready to deploy; content lives in `content/*.json`. Phase 2 (Payload CMS) is
specified but not built — the `bun run gen:cms` and `bun run seed` commands
do not exist yet.

Deployed URL: TBD — Vercel import pending

See [`TOKEN-GAPS.md`](TOKEN-GAPS.md) for design-token literals not bound to a
Figma variable.

## Running locally

```bash
bun install
bun run dev
```

- **Landing page:** http://localhost:3000
- **CMS admin:** not available yet. Phase 2 (Payload) is specced but not
  built — there is no `/admin` route, no `gen:cms`/`seed` command, and no
  database in this repo. Content for now lives directly in `content/*.json`.

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

| Command | Description |
|---------|-------------|
| `bun install` | Install dependencies |
| `bun run dev` | Start the development server |
| `bun run build` | Production build |
| `bun run test` | Run unit tests (Vitest) |
| `bun run e2e` | Run end-to-end tests (Playwright) — starts the dev server itself |
| `bun run e2e:report` | Open the e2e HTML report with traces, videos, screenshots |
| `bun run lint` | Run the linter |
| `bun run validate:manifest` | Validate `site.manifest.json` against the schema |
| `bun run verify:design` | Compare the running page against the Figma references (needs a dev server) |
| `bun run gen:cms` | Phase 2, not yet built — will generate `payload.config.ts` from `site.manifest.json` |
| `bun run seed` | Phase 2, not yet built — will load `content/*.json` into Payload |

## Testing

Unit tests cover the manifest schema and the content seam. End-to-end tests cover
the running app, the seam over real HTTP, and the validator CLI as a subprocess:

```bash
bunx playwright install chromium --with-deps   # once
bun run e2e
```

Every e2e test records a screenshot, video, and trace into `e2e-results/`
(gitignored); CI uploads that directory as a workflow artifact. Committed
evidence and reproduction details live in [`docs/e2e/README.md`](docs/e2e/README.md).

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
catch a real defect. See [`docs/decisions/0008`](docs/decisions/) for the
reasoning and the known limits.

This check exists because Phase 1 shipped a hero section rendering a green band
inside a green band while every other gate was green. The manifest validated,
the unit tests passed, the build succeeded, and this very e2e suite screenshotted
the page at three viewports — and compared those screenshots to nothing.

`e2e/content-seam.spec.ts` is the one to preserve: it asserts that no
locale-suffixed key ever reaches rendered HTML, which is what keeps the Phase 2
migration a backend swap rather than a refactor. It renders through a test-only
route gated behind `E2E=1`, which 404s on any normally-started server.

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
- **`content/*.json`** — Phase 1 storage, and the initial bootstrap seed for
  Phase 2. After Phase 2 goes live, Payload's database is the sole authority
  for content and recovery is by database backup; these files stay in git only
  as the record of what was originally extracted from Figma, useful for
  re-seeding a fresh environment, never for restoring a live one.

Full design: [`docs/superpowers/specs/2026-08-21-figma-to-cms-pipeline-design.md`](docs/superpowers/specs/2026-08-21-figma-to-cms-pipeline-design.md)

## Decisions

| ADR | Decision |
|-----|----------|
| [0001](docs/decisions/0001-nextjs-payload-single-repo.md) | Next.js + Payload in a single repository |
| [0002](docs/decisions/0002-manifest-driven-generation.md) | Generate components, content, and schema from one manifest |
| [0003](docs/decisions/0003-token-and-section-rebuild.md) | Rebuild Figma as semantic sections, not pixel-faithful codegen |
| [0004](docs/decisions/0004-content-json-in-cms-shape.md) | Phase 1 content stored in the CMS's shape |
| [0005](docs/decisions/0005-native-localization-suffix-interchange.md) | Payload native localization; `_en` suffix as interchange format |
| [0006](docs/decisions/0006-bun-as-package-manager.md) | Bun as package manager and script runner; Node.js as the runtime |

## Adding a language

Append the locale to `locales` in `site.manifest.json`, run `bun run gen:cms`. No
migration, no new columns. Fields are empty until an editor fills them, and
Payload's fallback serves English in the meantime.
