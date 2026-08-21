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
2. `content/*.json` seed — Phase 1 storage, keys suffixed by locale
3. `payload.config.ts` globals and collections — Phase 2

`kind: "global"` → Payload Global (singleton section). `kind: "collection"` →
Payload Collection (repeating items).

### Language convention

`translatable: true` is the single flag driving language handling. It means two
different things in the two phases, deliberately:

- **Phase 1 (no CMS):** the seed emitter writes `<field>_<locale>` keys —
  `headline_en`. Flat JSON, no infrastructure required.
- **Phase 2 (Payload):** the config emitter writes `localized: true` on the
  field. Payload owns locale storage, and `localization.locales` in the config
  is generated from the manifest's `locales` array.

The `_en` suffix therefore survives as the project's **interchange format** —
seed files, exports, and the manifest itself — rather than as a storage layout.

**Why not suffix all the way into the database.** Suffixed columns would keep
one convention end to end, but on Postgres each new language adds a column per
translatable field (ten fields × one language = ten `ALTER TABLE`s), the admin
panel renders every language of every field simultaneously with no locale
switcher, and fallback has to be hand-written in application code. Native
localization adds a locale with a single config array entry and no migration,
ships the switcher and server-side fallback for free, and still exposes flat
per-locale documents through the API. The stated requirement — every
translatable field addressable by language code, `en`-only by default, more
languages later without schema changes — is met more completely this way.

**Accepted cost:** content portability now runs through Payload's
`locale=all`, which returns `{ headline: { en, id } }` — nested, not flat. If
an external consumer ever needs the flat suffixed form, add a ~20-line export
script that flattens `locale=all`. Not built until something actually needs it.

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
// Phase 1 — flat suffixed JSON, app-side locale resolution
export const getGlobal = (name, loc = 'en') =>
  strip(import(`@/content/globals/${name}.json`), loc)

// Phase 2 — identical signature; Payload resolves the locale and the fallback
export const getGlobal = (name, loc = 'en') =>
  payload.findGlobal({ slug: name, locale: loc, fallbackLocale: 'en' })
```

Both implementations return the **same shape**: a plain object with unsuffixed
keys for the requested locale (`{ headline: "..." }`). `strip()` is the Phase 1
half — it selects `<field>_<loc>`, falls back to `<field>_en`, and drops the
suffix. Components receive resolved objects and never learn which backend is
live, nor that suffixes ever existed.

`strip()` and its fallback logic are Phase 1 only. Phase 2 deletes them; Payload
does that work server-side.

## Phase 2 — migration

```bash
bun run gen:cms   # manifest → payload.config.ts (localized fields + locales array)
bun run seed      # content/*.json → Payload, suffix keys mapped to locales
bun run dev       # /admin live
# flip lib/content.ts to the Payload impl; delete the JSON reader and strip()
```

The seed script is the only place the two representations meet: it reads
`headline_en` from the JSON and writes it to the `headline` field under locale
`en`. No component is touched. No copy is retyped. `content/*.json` remains in
git as the seed of record and the fallback if the CMS is lost.

### Adding a language later

Append the locale to `locales` in the manifest and rerun `bun run gen:cms`. Payload
gains the locale in its `localization.locales` array — no migration, no new
columns. Fields are empty until an editor fills them; Payload's `fallback`
serves `en` in the meantime. The admin locale switcher appears automatically.

## Error handling

- Missing Figma variable → literal value plus a `TOKEN-GAPS.md` entry.
- Manifest/CMS drift after hand edits → `gen:cms` is idempotent; a zod check
  fails CI when config and manifest disagree.
- Missing translation → Payload's `fallbackLocale` serves `en` (Phase 2);
  `strip()` does the same (Phase 1). Never an empty render.
- Re-running the seed → upsert by slug, never append.
- **Never toggle `localized` on an existing field** — Payload warns this changes
  the stored data structure and can lose content. `translatable` is fixed at
  manifest-review time; changing it later requires a written migration, and
  `gen:cms` refuses the change with an explicit error rather than emitting it.

## Testing

Three checks, deliberately no more:

- `site.manifest.json` validates against its zod schema (catches generator drift)
- one render snapshot per section
- `strip()` unit test: missing locale falls back to `_en` and suffixes are
  dropped from the returned shape

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

- No extractor/builder/schema/migrator subagent fleet. The pipeline is serial
  with a single parallel step. A skill plus code generators does the same work
  with less to maintain and clearer failure attribution.
- No flat-suffix export from Payload until an external consumer needs one.
