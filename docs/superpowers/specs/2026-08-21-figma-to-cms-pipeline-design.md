# Figma → Static Site → CMS Pipeline

**Date:** 2026-08-21
**Status:** Approved design

## Goal

An agent-runnable pipeline that converts a Figma file into a live static site
(Phase 1), then into an admin-editable CMS-backed site (Phase 2), with no copy
rework between phases. Reusable across projects and brands.

Case study: `https://www.figma.com/site/MaLWllTIfpUeIZ1Nqi1EJJ/Modern-Product-Launch--Community-`

## Stack

- Next.js (App Router, static export in Phase 1)
- Payload CMS (Phase 2, same repo, same app)
- Tailwind (theme generated from Figma variables)
- Vercel

## Keystone: `site.manifest.json`

Single source of truth. Generated during extraction, reviewed by a human, then
consumed by every downstream generator.

```jsonc
{
  "locales": ["en"],
  "tokens": { /* from get_variable_defs */ },
  "sections": [
    { "name": "Hero", "kind": "global",
      "fields": [
        { "name": "headline", "type": "text", "translatable": true },
        { "name": "ctaHref",  "type": "url",  "translatable": false }
      ]},
    { "name": "Features", "kind": "collection",
      "fields": [ { "name": "title", "type": "text", "translatable": true } ] }
  ]
}
```

Three artifacts derive from it, never hand-authored twice:

1. React section components (props = fields)
2. `content/*.json` seed — Phase 1 storage, keys already suffixed
3. `payload.config.ts` globals and collections — Phase 2

`kind: "global"` → Payload Global (singleton section). `kind: "collection"` →
Payload Collection (repeating items).

### Language convention

`translatable: true` makes the emitter write `<field>_<locale>` for every entry
in `locales`. Default `["en"]` → `headline_en`. Adding a locale means appending
to `locales` and rerunning the generator; existing content is untouched.

**Tradeoff (accepted):** this bypasses Payload's native localization API. Cost —
no built-in admin locale switcher; fields render side by side. Benefit — flat,
portable JSON matching the required convention, independent of any one CMS.

## Phase 1 — extraction and static site

Serial, one agent. Each step feeds the next.

1. **Inventory** — `get_metadata` on the file root; agent names top-level frames
   as sections.
2. **Tokens** — `get_variable_defs` → Tailwind theme. Any value that is not a
   Figma variable becomes a literal and is logged to `TOKEN-GAPS.md`. No silent
   drift.
3. **Copy and assets** — `get_design_context` per section for text and
   structure; `download_assets` for images and icons into `public/`. Text goes
   into the seed JSON, never into JSX. This step is what makes Phase 2 free.
4. **Manifest write** — agent proposes `site.manifest.json`, then **stops for
   human review**. The one gate in the pipeline: a wrong field name here
   propagates into components, seed, and CMS schema simultaneously.
5. **Screenshots** — `get_screenshot` per section into `design/refs/`, used as
   the build target and the review baseline.

### Build

Manifest frozen → one component per section under `components/sections/`, each
`async` and fetching its own content. Sections are independent once the manifest
is frozen, so this is the one step worth fanning out: N sections, N parallel
agents, each given its manifest entry and its reference screenshot. Page
composition is a flat list of sections.

### Ship

Next.js static export → Vercel. The site is live at the end of Phase 1, with all
copy in `content/*.json` under `_en` keys.

## The seam: `lib/content.ts`

```ts
const locales = ['en'] as const           // generated from manifest

export const t = (obj, field, loc = 'en') =>
  obj[`${field}_${loc}`] ?? obj[`${field}_en`]

// Phase 1
export const getGlobal = (name) => import(`@/content/globals/${name}.json`)

// Phase 2 — identical signature
export const getGlobal = (name) => payload.findGlobal({ slug: name })
```

Components receive plain objects and call `t()`. They never learn which backend
is live. Swapping this file is the migration; nothing else is a refactor.

## Phase 2 — migration

```bash
pnpm gen:cms      # manifest → payload.config.ts
pnpm seed         # content/*.json → Payload, verbatim keys
pnpm dev          # /admin live
# flip lib/content.ts to the Payload impl; delete the JSON reader
```

No component is touched. No copy is retyped. `content/*.json` remains in git as
the seed of record and the fallback if the CMS is lost.

### Adding a language later

Append the locale to `locales`, run `pnpm gen:cms`. Payload gains `headline_id`
beside `headline_en`, empty. `t()` falls back to `_en` until an editor fills it.
No content migration, no downtime.

## Error handling

- Missing Figma variable → literal value plus a `TOKEN-GAPS.md` entry.
- Manifest/CMS drift after hand edits → `gen:cms` is idempotent; a zod check
  fails CI when config and manifest disagree.
- Missing translation → `t()` falls back to `_en`; never an empty render.
- Re-running the seed → upsert by slug, never append.

## Testing

Three checks, deliberately no more:

- `site.manifest.json` validates against its zod schema (catches generator drift)
- one render snapshot per section
- `t()` unit test: missing locale falls back to `_en`

Not built: visual regression, e2e. Add when traffic justifies them.

## Packaging

- **Template repo** — `lib/content.ts`, the generators, zod schemas, test setup,
  an empty `site.manifest.json`.
- **Skill `figma-to-site`** — the five extraction steps, the manifest schema, the
  review gate, the build fan-out instruction.

A new project is: clone the template, point the skill at a Figma URL. Neither
artifact contains brand-specific content; the design lives entirely in tokens
plus manifest.

## Explicitly not built

No extractor/builder/schema/migrator subagent fleet. The pipeline is serial with
a single parallel step. A skill plus code generators does the same work with less
to maintain and clearer failure attribution.
