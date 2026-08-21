# company-profile-with-cms

A pipeline that converts a Figma file into a live static site, then evolves it
into an admin-editable, CMS-backed, multi-language site — with no copy rework
between the two phases.

**Status: Tasks 1-3 implemented.** The Next.js scaffold, the manifest schema
(`schemas/manifest.ts`) and its validator (`scripts/validate-manifest.ts`), and
the content seam (`lib/content.ts`) are built and tested. Tasks 4-6 (Figma
extraction, section components, static export) are not started — blocked on
Figma file access.

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
| `bun run test` | Run tests |
| `bun run lint` | Run the linter |
| `bun run validate:manifest` | Validate `site.manifest.json` against the schema — currently exits 1, since that file does not exist yet |
| `bun run gen:cms` | Phase 2, not yet built — will generate `payload.config.ts` from `site.manifest.json` |
| `bun run seed` | Phase 2, not yet built — will load `content/*.json` into Payload |

## Architecture

- **`site.manifest.json`** — source of truth for sections and fields. Reviewed by
  a human before any generator runs; this is the pipeline's only gate.
- **`lib/content.ts`** — the seam between phases. Both implementations return the
  same locale-resolved shape, so components never learn which backend is live.
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
