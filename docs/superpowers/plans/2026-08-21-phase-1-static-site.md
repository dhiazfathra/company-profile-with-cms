# Phase 1 Static Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the case-study Figma file into a live, statically exported Next.js site whose every string lives in `content/*.json` under locale-suffixed keys.

**Architecture:** A human-reviewed `site.manifest.json` describes every section and field. Components receive content through `lib/content.ts`, which resolves a locale and strips the suffix, so components never see suffixed keys and never learn which backend serves them. Phase 2 replaces only that file.

**Tech Stack:** Bun (package manager + script runner), Node.js 20.9.0+ (runtime), Next.js App Router with static export, TypeScript, Tailwind CSS, Zod, Vitest, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-21-figma-to-cms-pipeline-design.md`

**Decisions:** `docs/decisions/0001` through `0006`

## Global Constraints

- Node.js `>=20.9.0` — Payload's floor, pinned now so Phase 2 needs no change (ADR-0006).
- Bun installs and runs scripts (`bun install`, `bun run <script>`). Never bare `bun test` — that invokes Bun's runner and ignores the `package.json` script.
- No Bun-only globals (`Bun.file`, `Bun.serve`) in any script. Scripts also run on Vercel's Node build step (ADR-0006).
- The application runs on Node, never the Bun runtime. No `bun --bun`.
- `locales[0]` is always `"en"`. Phase 1 ships English only.
- Zero literal user-facing copy in JSX. Every string comes from `content/*.json` (ADR-0004).
- Translatable field keys are `<field>_<locale>` in Phase 1 content files (ADR-0005).
- `site.manifest.json` is human-reviewed before any downstream work. This is the pipeline's only gate (ADR-0002).
- Figma values that are not variables become literals AND get an entry in `TOKEN-GAPS.md`. Never silently inline (ADR-0003).

## File Structure

| Path                           | Responsibility                                                       |
| ------------------------------ | -------------------------------------------------------------------- |
| `site.manifest.json`           | Source of truth: locales, tokens, sections, fields                   |
| `schemas/manifest.ts`          | Zod schema + inferred types for the manifest                         |
| `scripts/validate-manifest.ts` | CLI that validates the manifest; used by CI                          |
| `lib/content.ts`               | The phase seam: locale resolution + suffix stripping + content reads |
| `content/globals/*.json`       | Singleton section content, suffixed keys                             |
| `content/collections/*.json`   | Repeating item content, suffixed keys                                |
| `components/sections/*.tsx`    | One semantic component per Figma section                             |
| `app/page.tsx`                 | Composes sections in order                                           |
| `app/layout.tsx`               | Root layout, fonts, global styles                                    |
| `design/refs/*.png`            | Per-section reference screenshots from Figma                         |
| `TOKEN-GAPS.md`                | Figma values that were not variables                                 |

Deliberately absent: a component generator and a seed generator. Components are written once by agents from the manifest plus a screenshot; the seed is written once during extraction. A code generator earns its keep in Phase 2 (`gen:cms`), where the same manifest must stay in sync with a live schema across many runs. Writing one now would be scaffolding for a single use.

---

### Task 1: Project scaffold

**Files:**

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `vitest.config.ts`, `.gitignore`, `.nvmrc`
- Test: `tests/scaffold.test.ts`

**Interfaces:**

- Consumes: nothing
- Produces: a working `bun run dev`, `bun run test`, `bun run lint`, `bun run build`; path alias `@/*` resolving to the repo root

- [ ] **Step 1: Scaffold Next.js**

```bash
bun create next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint
```

Answer "no" to Turbopack if prompted. If the directory is not empty, the CLI refuses — that is expected, since `docs/` and `README.md` exist. Scaffold into a temp directory and move the files in:

```bash
bun create next-app@latest /tmp/scaffold --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint
cp -r /tmp/scaffold/. .
rm -rf /tmp/scaffold
git checkout README.md   # the scaffold overwrites it; ours is the one we keep
```

- [ ] **Step 2: Pin the Node floor and add scripts**

Edit `package.json` — add the `engines` block and replace the `scripts` block:

```json
{
  "engines": { "node": ">=20.9.0" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "validate:manifest": "tsx scripts/validate-manifest.ts"
  }
}
```

Create `.nvmrc` containing exactly:

```
20.9.0
```

- [ ] **Step 3: Add test and validation dependencies**

```bash
bun add zod
bun add -d vitest @vitejs/plugin-react vite-tsconfig-paths @testing-library/react @testing-library/jest-dom happy-dom tsx
```

`tsx` runs the TypeScript validator script under Node, satisfying the runtime-agnostic constraint.

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
```

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Vitest rather than Bun's built-in runner: it executes on Node, matching the application runtime, and is the documented path for React component testing. `bun test` would work with fewer dependencies — revisit if the Vitest config becomes a maintenance cost.

- [ ] **Step 5: Write a test that proves the toolchain runs**

Create `tests/scaffold.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import pkg from '../package.json'

describe('scaffold', () => {
  it('pins the Node floor Payload requires', () => {
    expect(pkg.engines.node).toBe('>=20.9.0')
  })

  it('runs tests through a package script, not bun test', () => {
    expect(pkg.scripts.test).toBe('vitest run')
  })
})
```

- [ ] **Step 6: Run the test suite**

Run: `bun run test`
Expected: PASS, 2 tests.

- [ ] **Step 7: Verify dev server and lint**

Run: `bun run lint`
Expected: no errors.

Run: `bun run dev`, open `http://localhost:3000`, confirm the Next.js starter renders, then stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with bun, vitest, and tailwind

- pin engines.node to >=20.9.0 per ADR-0006
- test script runs vitest on Node, invoked via bun run"
```

---

### Task 2: Manifest schema and validator

**Files:**

- Create: `schemas/manifest.ts`, `scripts/validate-manifest.ts`
- Test: `tests/manifest.test.ts`

**Interfaces:**

- Consumes: nothing
- Produces:
  - `ManifestSchema: ZodType<Manifest>`
  - `type Manifest = { locales: string[]; tokens: Record<string, unknown>; sections: Section[] }`
  - `type Section = { name: string; kind: 'global' | 'collection'; fields: Field[] }`
  - `type Field = { name: string; type: 'text' | 'richText' | 'url' | 'image' | 'number'; translatable: boolean }`
  - CLI: `bun run validate:manifest` — exit 0 on valid, exit 1 with messages on invalid

- [ ] **Step 1: Write the failing tests**

Create `tests/manifest.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ManifestSchema } from '@/schemas/manifest'

const valid = {
  locales: ['en'],
  tokens: { color: { brand: '#5B4DF5' } },
  sections: [
    {
      name: 'Hero',
      kind: 'global',
      fields: [
        { name: 'headline', type: 'text', translatable: true },
        { name: 'ctaHref', type: 'url', translatable: false },
      ],
    },
  ],
}

describe('ManifestSchema', () => {
  it('accepts a minimal valid manifest', () => {
    expect(ManifestSchema.parse(valid)).toEqual(valid)
  })

  it('requires en as the first locale', () => {
    const bad = { ...valid, locales: ['id', 'en'] }
    expect(() => ManifestSchema.parse(bad)).toThrow(/locales\[0\] must be "en"/)
  })

  it('rejects duplicate section names', () => {
    const bad = { ...valid, sections: [valid.sections[0], valid.sections[0]] }
    expect(() => ManifestSchema.parse(bad)).toThrow(/duplicate section name/i)
  })

  it('rejects duplicate field names within a section', () => {
    const bad = {
      ...valid,
      sections: [
        {
          ...valid.sections[0],
          fields: [valid.sections[0].fields[0], valid.sections[0].fields[0]],
        },
      ],
    }
    expect(() => ManifestSchema.parse(bad)).toThrow(/duplicate field name/i)
  })

  it('rejects a field name that already carries a locale suffix', () => {
    const bad = {
      ...valid,
      sections: [
        {
          ...valid.sections[0],
          fields: [{ name: 'headline_en', type: 'text', translatable: true }],
        },
      ],
    }
    expect(() => ManifestSchema.parse(bad)).toThrow(/must not include a locale suffix/i)
  })

  it('rejects a section with no fields', () => {
    const bad = { ...valid, sections: [{ ...valid.sections[0], fields: [] }] }
    expect(() => ManifestSchema.parse(bad)).toThrow()
  })
})
```

The suffix test matters: a field named `headline_en` in the manifest would produce `headline_en_en` in the seed, and in Phase 2 a Payload field literally named `headline_en` with localization on top. Catching it here is the difference between a validation error and a schema that has to be migrated later.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test tests/manifest.test.ts`
Expected: FAIL — cannot resolve `@/schemas/manifest`.

- [ ] **Step 3: Write the schema**

Create `schemas/manifest.ts`:

```ts
import { z } from 'zod'

const LOCALE = /^[a-z]{2}(-[A-Z]{2})?$/

const FieldSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9]*$/, 'field name must be lowerCamelCase')
    .refine((n) => !LOCALE.test(n.split('_').pop() ?? ''), {
      message: 'field name must not include a locale suffix; set translatable instead',
    }),
  type: z.enum(['text', 'richText', 'url', 'image', 'number']),
  translatable: z.boolean(),
})

const SectionSchema = z
  .object({
    name: z.string().regex(/^[A-Z][a-zA-Z0-9]*$/, 'section name must be PascalCase'),
    kind: z.enum(['global', 'collection']),
    fields: z.array(FieldSchema).min(1),
  })
  .superRefine((section, ctx) => {
    const seen = new Set<string>()
    for (const field of section.fields) {
      if (seen.has(field.name)) {
        ctx.addIssue({ code: 'custom', message: `duplicate field name: ${field.name}` })
      }
      seen.add(field.name)
    }
  })

export const ManifestSchema = z
  .object({
    locales: z.array(z.string().regex(LOCALE)).min(1),
    tokens: z.record(z.string(), z.unknown()),
    sections: z.array(SectionSchema).min(1),
  })
  .superRefine((manifest, ctx) => {
    if (manifest.locales[0] !== 'en') {
      ctx.addIssue({ code: 'custom', message: 'locales[0] must be "en" (the default locale)' })
    }
    const seen = new Set<string>()
    for (const section of manifest.sections) {
      if (seen.has(section.name)) {
        ctx.addIssue({ code: 'custom', message: `duplicate section name: ${section.name}` })
      }
      seen.add(section.name)
    }
  })

export type Manifest = z.infer<typeof ManifestSchema>
export type Section = Manifest['sections'][number]
export type Field = Section['fields'][number]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test tests/manifest.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the validator CLI**

Create `scripts/validate-manifest.ts`:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ManifestSchema } from '../schemas/manifest'

const file = path.join(process.cwd(), 'site.manifest.json')
const result = ManifestSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))

if (!result.success) {
  console.error('site.manifest.json is invalid:\n')
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
  process.exit(1)
}

console.log(
  `site.manifest.json valid — ${result.data.sections.length} sections, locales: ${result.data.locales.join(', ')}`,
)
```

- [ ] **Step 6: Verify the CLI rejects a missing manifest**

Run: `bun run validate:manifest`
Expected: FAIL — `ENOENT`, no `site.manifest.json` yet. This is correct; Task 4 creates it.

- [ ] **Step 7: Commit**

```bash
git add schemas/manifest.ts scripts/validate-manifest.ts tests/manifest.test.ts package.json
git commit -m "feat: add manifest zod schema and validator CLI

- enforce en as default locale, unique section and field names
- reject field names carrying a locale suffix, which would double-suffix the seed"
```

---

### Task 3: The content seam

**Files:**

- Create: `lib/content.ts`
- Test: `tests/content.test.ts`, `tests/fixtures/content/globals/Sample.json`

**Interfaces:**

- Consumes: nothing
- Produces:
  - `DEFAULT_LOCALE = 'en'`
  - `strip(raw: Record<string, unknown>, locale?: string): Record<string, unknown>`
  - `getGlobal(name: string, locale?: string, dir?: string): Promise<Record<string, unknown>>`
  - `getCollection(name: string, locale?: string, dir?: string): Promise<Record<string, unknown>[]>`

  `dir` exists so tests can point at fixtures; it defaults to `'content'` and
  is not part of the Phase 2 contract, which will drop it.

Every section component in Task 5 calls `getGlobal` or `getCollection`. Phase 2 replaces the bodies of those two functions and deletes `strip`; the signatures do not change.

- [ ] **Step 1: Write the failing tests**

Create `tests/content.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { strip, getGlobal, getCollection, DEFAULT_LOCALE } from '@/lib/content'

describe('strip', () => {
  it('drops the suffix for the requested locale', () => {
    expect(strip({ headline_en: 'Launch' })).toEqual({ headline: 'Launch' })
  })

  it('leaves untranslatable keys untouched', () => {
    expect(strip({ headline_en: 'Launch', ctaHref: '/signup' })).toEqual({
      headline: 'Launch',
      ctaHref: '/signup',
    })
  })

  it('returns the requested locale when present', () => {
    expect(strip({ headline_en: 'Launch', headline_id: 'Peluncuran' }, 'id')).toEqual({
      headline: 'Peluncuran',
    })
  })

  it('falls back to en when the requested locale is missing', () => {
    expect(strip({ headline_en: 'Launch' }, 'id')).toEqual({ headline: 'Launch' })
  })

  it('prefers the requested locale regardless of key order', () => {
    expect(strip({ headline_id: 'Peluncuran', headline_en: 'Launch' }, 'id')).toEqual({
      headline: 'Peluncuran',
    })
    expect(strip({ headline_en: 'Launch', headline_id: 'Peluncuran' }, 'id')).toEqual({
      headline: 'Peluncuran',
    })
  })

  it('ignores locales that are neither requested nor the default', () => {
    expect(strip({ headline_en: 'Launch', headline_de: 'Start' }, 'id')).toEqual({
      headline: 'Launch',
    })
  })

  it('defaults to en', () => {
    expect(DEFAULT_LOCALE).toBe('en')
  })
})

describe('getGlobal', () => {
  it('reads and resolves a global', async () => {
    const hero = await getGlobal('Sample', 'en', 'tests/fixtures/content')
    expect(hero).toEqual({ headline: 'Launch', ctaHref: '/signup' })
  })
})

describe('getCollection', () => {
  it('resolves every item', async () => {
    const items = await getCollection('Samples', 'en', 'tests/fixtures/content')
    expect(items).toEqual([{ title: 'First' }, { title: 'Second' }])
  })
})
```

The key-order test is the one that matters. A naive implementation writes the English fallback, then never overwrites it when the requested locale appears later in the object — producing English on a page that has a perfectly good translation. It fails only when key order happens to put `_en` first, which is exactly the kind of bug that survives casual testing.

- [ ] **Step 2: Create the fixtures**

Create `tests/fixtures/content/globals/Sample.json`:

```json
{
  "headline_en": "Launch",
  "ctaHref": "/signup"
}
```

Create `tests/fixtures/content/collections/Samples.json`:

```json
[{ "title_en": "First" }, { "title_en": "Second" }]
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun run test tests/content.test.ts`
Expected: FAIL — cannot resolve `@/lib/content`.

- [ ] **Step 4: Write the implementation**

Create `lib/content.ts`:

```ts
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const DEFAULT_LOCALE = 'en'

const SUFFIXED = /^(.+)_([a-z]{2}(?:-[A-Z]{2})?)$/

/**
 * Resolves locale-suffixed keys down to plain ones for a single locale.
 *
 * Phase 1 only. Phase 2 deletes this: Payload resolves the locale and the
 * fallback server-side, and returns the same unsuffixed shape. Components
 * therefore never observe which phase they are running in — that is the whole
 * point of this module. See ADR-0004 and ADR-0005.
 */
export function strip(
  raw: Record<string, unknown>,
  locale: string = DEFAULT_LOCALE,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const exact = new Set<string>()

  for (const [key, value] of Object.entries(raw)) {
    const match = SUFFIXED.exec(key)
    if (!match) {
      out[key] = value
      continue
    }
    const [, field, keyLocale] = match
    if (keyLocale === locale) {
      out[field] = value
      exact.add(field)
    } else if (keyLocale === DEFAULT_LOCALE && !exact.has(field)) {
      // Fallback, but never over an exact match — regardless of key order.
      out[field] = value
    }
  }

  return out
}

const read = async (dir: string, kind: string, name: string) =>
  JSON.parse(await readFile(path.join(process.cwd(), dir, kind, `${name}.json`), 'utf8'))

export async function getGlobal(
  name: string,
  locale: string = DEFAULT_LOCALE,
  dir = 'content',
): Promise<Record<string, unknown>> {
  return strip(await read(dir, 'globals', name), locale)
}

export async function getCollection(
  name: string,
  locale: string = DEFAULT_LOCALE,
  dir = 'content',
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = await read(dir, 'collections', name)
  return items.map((item) => strip(item, locale))
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test tests/content.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/content.ts tests/content.test.ts tests/fixtures
git commit -m "feat: add the phase seam in lib/content.ts

- strip() resolves locale suffixes with en fallback, order-independent
- getGlobal/getCollection signatures are the Phase 2 contract"
```

---

### Task 4: Figma extraction and manifest review

**Files:**

- Create: `site.manifest.json`, `content/globals/*.json`, `content/collections/*.json`, `design/refs/*.png`, `TOKEN-GAPS.md`, `public/` assets
- Modify: `app/globals.css` (Tailwind theme from Figma variables)

**Interfaces:**

- Consumes: `ManifestSchema` from Task 2 (via `bun run validate:manifest`)
- Produces: a validated `site.manifest.json` and matching content files. Task 5 reads the manifest's `sections` array and the screenshots.

This task is agent work plus a human gate, not a TDD cycle. Its verification is the validator passing and a human approving the manifest.

Figma file: `https://www.figma.com/site/MaLWllTIfpUeIZ1Nqi1EJJ/Modern-Product-Launch--Community-`

- [ ] **Step 1: Inventory the sections**

Call the Figma MCP tool `get_metadata` on the file root. Record each top-level frame in reading order — these become sections. Do not descend into children yet; the goal is a section list, not a node tree.

Output a plain list to the conversation, e.g. `Hero, FeatureGrid, Community, Pricing, CTA, Footer`. Do not write files yet.

- [ ] **Step 2: Extract design tokens**

Call `get_variable_defs` on the file root. Map the result into the Tailwind v4 theme block in `app/globals.css`:

```css
@import 'tailwindcss';

@theme {
  --color-brand: #5b4df5; /* replace with real variable values */
  --font-display: 'Inter', sans-serif;
  --spacing-section: 6rem;
}
```

Every design value that came back as a literal rather than a named variable gets a row in `TOKEN-GAPS.md`:

```markdown
# Token Gaps

Values present in the Figma file that are not bound to a Figma variable. Each is
a literal in the code and will drift if the design changes.

| Value     | Where it appears | Suggested variable        |
| --------- | ---------------- | ------------------------- |
| `#0B0B14` | Hero background  | `--color-surface-inverse` |
```

Create the file even if it is empty — an empty gaps file is a claim that nothing drifted, and a missing one is silence.

- [ ] **Step 3: Extract copy, structure, and assets**

For each section from Step 1:

- `get_design_context` on the frame — read the text content and layout structure.
- `get_screenshot` on the frame — save to `design/refs/<SectionName>.png`.
- `download_assets` for any image or icon the section needs — save under `public/`.

Collect the copy; do not write it into components. It goes into `content/` in Step 5.

- [ ] **Step 4: Propose the manifest**

Write `site.manifest.json`. Every section from Step 1 becomes an entry. For each text or media slot found in Step 3, add a field:

```json
{
  "locales": ["en"],
  "tokens": { "color": { "brand": "#5B4DF5" } },
  "sections": [
    {
      "name": "Hero",
      "kind": "global",
      "fields": [
        { "name": "eyebrow", "type": "text", "translatable": true },
        { "name": "headline", "type": "text", "translatable": true },
        { "name": "subhead", "type": "text", "translatable": true },
        { "name": "ctaLabel", "type": "text", "translatable": true },
        { "name": "ctaHref", "type": "url", "translatable": false },
        { "name": "heroImage", "type": "image", "translatable": false }
      ]
    },
    {
      "name": "FeatureGrid",
      "kind": "collection",
      "fields": [
        { "name": "title", "type": "text", "translatable": true },
        { "name": "body", "type": "text", "translatable": true },
        { "name": "icon", "type": "image", "translatable": false }
      ]
    }
  ]
}
```

Rules for the judgement calls:

- A section that appears once is `kind: "global"`. A section rendering a repeating card, item, or row is `kind: "collection"`, and its fields describe **one item**, not the list.
- `translatable: true` for anything a human reads as prose. `false` for URLs, image references, icon names, and numbers that are not written out as words.
- `translatable` is fixed at review time. Changing it after Phase 2 exists risks content loss (ADR-0005), so decide it now.

- [ ] **Step 5: Write the seed content**

For each section, write `content/globals/<Name>.json` or `content/collections/<Name>.json` using the copy from Step 3. Every `translatable: true` field gets an `_en` suffix; every other field does not:

```json
{
  "eyebrow_en": "Now in open beta",
  "headline_en": "Ship your launch, not your CMS",
  "subhead_en": "Everything your community needs on day one.",
  "ctaLabel_en": "Join the beta",
  "ctaHref": "/signup",
  "heroImage": "/hero.png"
}
```

Collection files are arrays of such objects.

- [ ] **Step 6: Validate**

Run: `bun run validate:manifest`
Expected: PASS, printing the section count and `locales: en`.

If it fails on a suffixed field name, the fix is in the manifest (drop the suffix, set `translatable: true`), not in the schema.

- [ ] **Step 7: STOP for human review**

Present to the human:

- the section list and each one's `kind`
- every field name with its `translatable` flag
- `TOKEN-GAPS.md`

Ask explicitly: _"Approve this manifest? Field names and translatable flags are expensive to change after Phase 2."_

Do not proceed to Task 5 without approval. This is the pipeline's only gate, and it exists because a wrong field name here propagates into components, content, and the CMS schema simultaneously (ADR-0002).

- [ ] **Step 8: Commit**

```bash
git add site.manifest.json content/ design/ public/ TOKEN-GAPS.md app/globals.css
git commit -m "feat: extract Figma design into manifest, tokens, and seed content

- section inventory and fields from the Modern Product Launch file
- design tokens mapped into the Tailwind theme; gaps recorded in TOKEN-GAPS.md
- all copy seeded into content/ with _en suffixes, none in JSX"
```

---

### Task 5: Section components and page composition

**Files:**

- Create: `components/sections/<Name>.tsx` (one per manifest section)
- Modify: `app/page.tsx`
- Test: `tests/sections.test.tsx`

**Interfaces:**

- Consumes: `getGlobal`, `getCollection` from Task 3; `site.manifest.json` and `design/refs/*.png` from Task 4
- Produces: one default-exported async React component per section, named for the section, taking no props

Sections are independent once the manifest is frozen. This is the one step worth parallelising: dispatch one subagent per section, each given its manifest entry, its content file, and its reference screenshot.

- [ ] **Step 1: Write the failing test**

Create `tests/sections.test.tsx`. Replace the section list with the real ones from the manifest:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import manifest from '@/site.manifest.json'
import Hero from '@/components/sections/Hero'

describe('sections', () => {
  it('renders every section named in the manifest', async () => {
    for (const section of manifest.sections) {
      const mod = await import(`@/components/sections/${section.name}`)
      expect(mod.default, `${section.name} must default-export a component`).toBeTypeOf('function')
    }
  })

  it('renders Hero content from the seed, not from literals', async () => {
    const { container } = render(await Hero())
    const hero = (await import('@/content/globals/Hero.json')).default
    expect(container.textContent).toContain(hero.headline_en)
  })

  it('contains no hardcoded copy in component source', async () => {
    const { readFile } = await import('node:fs/promises')
    const source = await readFile('components/sections/Hero.tsx', 'utf8')
    const hero = (await import('@/content/globals/Hero.json')).default
    expect(source).not.toContain(hero.headline_en)
  })
})
```

The third test is the one that protects Phase 2. A component can render correct content and still have the copy pasted into the JSX beside it; only reading the source catches that.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test tests/sections.test.tsx`
Expected: FAIL — cannot resolve `@/components/sections/Hero`.

- [ ] **Step 3: Write one component per section**

Dispatch one subagent per section. Each receives: the section's manifest entry, its content JSON, its screenshot at `design/refs/<Name>.png`, and this template.

`components/sections/Hero.tsx` — a `global` section:

```tsx
import { getGlobal } from '@/lib/content'

export default async function Hero() {
  const c = await getGlobal('Hero')

  return (
    <section className="px-6 py-24 text-center">
      <p className="text-sm uppercase tracking-widest">{c.eyebrow as string}</p>
      <h1 className="mt-4 text-5xl font-bold">{c.headline as string}</h1>
      <p className="mt-6 text-lg">{c.subhead as string}</p>
      <a href={c.ctaHref as string} className="mt-8 inline-block rounded bg-brand px-6 py-3">
        {c.ctaLabel as string}
      </a>
    </section>
  )
}
```

`components/sections/FeatureGrid.tsx` — a `collection` section:

```tsx
import { getCollection } from '@/lib/content'

export default async function FeatureGrid() {
  const items = await getCollection('FeatureGrid')

  return (
    <section className="grid gap-8 px-6 py-24 md:grid-cols-3">
      {items.map((item) => (
        <article key={item.title as string}>
          <h3 className="text-xl font-semibold">{item.title as string}</h3>
          <p className="mt-2">{item.body as string}</p>
        </article>
      ))}
    </section>
  )
}
```

Constraints every subagent must hold:

- No literal user-facing string in the JSX. Every visible word comes from the content object.
- Use Tailwind classes bound to the theme from Task 4. No arbitrary hex values.
- Match the screenshot's structure and hierarchy, not its exact pixels (ADR-0003).
- The component takes no props and fetches its own content.

- [ ] **Step 4: Compose the page**

Replace `app/page.tsx` — import each section in manifest order:

```tsx
import Hero from '@/components/sections/Hero'
import FeatureGrid from '@/components/sections/FeatureGrid'

export default function Home() {
  return (
    <main>
      <Hero />
      <FeatureGrid />
    </main>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test`
Expected: PASS, all suites.

- [ ] **Step 6: Review against the reference screenshots**

Run: `bun run dev`, open `http://localhost:3000`, and compare each section against its `design/refs/<Name>.png`. This is a human judgement on structure and hierarchy, not a pixel diff. Fix structural mismatches; do not chase exact spacing.

- [ ] **Step 7: Commit**

```bash
git add components/ app/page.tsx tests/sections.test.tsx
git commit -m "feat: add section components reading from the content seam

- one semantic component per manifest section, no props, self-fetching
- test asserts no hardcoded copy in component source"
```

---

### Task 6: Static export and deploy

**Files:**

- Modify: `next.config.ts`, `README.md`
- Create: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: everything above
- Produces: a live URL

- [ ] **Step 1: Enable static export**

Replace `next.config.ts`:

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
}

export default config
```

`images.unoptimized` is required: static export has no server to run Next's image optimizer. Phase 2 removes both lines when Payload needs a server.

- [ ] **Step 2: Verify the build**

Run: `bun run build`
Expected: PASS, with an `out/` directory containing `index.html`.

Run: `npx serve out`, open the served URL, confirm the page renders with real content and no missing assets.

- [ ] **Step 3: Add CI**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - run: bun install --frozen-lockfile
      - run: bun run validate:manifest
      - run: bun run lint
      - run: bun run test
      - run: bun run build
```

Node is installed alongside Bun deliberately: Bun installs dependencies, Node runs the build, matching production (ADR-0006).

- [ ] **Step 4: Deploy**

Push the branch and import the repository in Vercel. Vercel detects `bun.lock` and installs with `bun install` — no `installCommand` override needed. Set the project's Node version to 20.x to match `.nvmrc`.

Confirm the deployed URL renders correctly.

- [ ] **Step 5: Update the README**

In `README.md`, replace the status line:

```markdown
**Status: Phase 1 live.** The static site is deployed; content lives in
`content/*.json`. Phase 2 (Payload CMS) is specified but not built — the
`bun run gen:cms` and `bun run seed` commands do not exist yet.
```

Add the deployed URL under the project description.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts README.md .github/
git commit -m "feat: static export, CI, and Vercel deploy

- output: export with unoptimized images; both revert in Phase 2
- CI installs with bun, builds on Node, matching production"
```

---

## Verification

Phase 1 is done when all of these hold:

- [ ] `bun run validate:manifest` exits 0
- [ ] `bun run lint` reports no errors
- [ ] `bun run test` passes every suite
- [ ] `bun run build` produces `out/`
- [ ] The deployed URL renders every section
- [ ] `grep -r` for any headline string from `content/` finds no match under `components/`
- [ ] `TOKEN-GAPS.md` exists and is accurate

## What Phase 2 Will Change

Recorded here so the boundary stays visible while implementing:

- `lib/content.ts` — bodies of `getGlobal`/`getCollection` swap to Payload; `strip` is deleted
- `next.config.ts` — `output: 'export'` and `images.unoptimized` removed
- New: `payload.config.ts` (generated), `scripts/gen-cms.ts`, `scripts/seed.ts`

Unchanged: every section component, `app/page.tsx`, `schemas/manifest.ts`, `site.manifest.json`, and `content/*.json`, which becomes the seed of record.

## Phase 2 — done

Implemented as predicted above, plus what the prediction didn't foresee:

- `lib/content.ts` — `getGlobal`/`getCollection` now read through Payload's
  local API (`fallbackLocale: 'en'`); `strip()` and the JSON reader are
  deleted. Both functions are built by `createContentApi(getPayload)`, a
  small seam that lets tests point them at a throwaway Payload instance.
- `next.config.ts` — `output: 'export'` removed; wrapped in `withPayload`.
  `app/page.tsx` is now `export const dynamic = 'force-dynamic'`: content
  comes from a live Payload instance, so it can no longer be prerendered at
  build time.
- New: `payload.config.ts` (generated, do not hand-edit), `scripts/gen-cms.ts`
  (generator + the `translatable`-flip guard), `scripts/check-cms-drift.ts`,
  `scripts/seed.ts`, `lib/payload.ts`, `.payload-field-locales.json`
  (the flip-guard's snapshot), and the `app/(payload)/` route group
  (`/admin`, REST, GraphQL).
- Removed: `app/e2e-seam/` and `e2e/content-seam.spec.ts` — Phase 1
  scaffolding built to exercise `strip()` over HTTP. Its job (proving the
  locale fallback) is now covered directly in `tests/content.test.ts`
  against a real in-memory Payload instance, per the design spec's testing
  section.
