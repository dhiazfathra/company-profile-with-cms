/**
 * Enumerates what the CMS actually has, by importing the config the running
 * admin panel uses — not by reading site.manifest.json and not from a list
 * written down by hand.
 *
 * The distinction is the whole point. `payload.config.ts` is generated from the
 * manifest, so a matrix built from the manifest would agree with the generator
 * even when the generator is what is wrong. And a hardcoded page list goes stale
 * the first time someone adds a section — silently, because a test suite that
 * never heard of a field reports green on it.
 *
 * Constraints are probed, not read. Payload's sanitized config attaches a
 * `validate` function to every field, so "has a validator" says nothing; what
 * separates a plain text field from a URL field is what its validator *returns*
 * for a bad value. So each field's validator is called, and the message it gives
 * back is what lands in the inventory.
 */
import type { Field, SanitizedConfig } from 'payload'

/** Payload writes these itself; an editor never types into them. */
const AUTO = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'filename',
  'mimeType',
  'filesize',
  'width',
  'height',
  'focalX',
  'focalY',
  'thumbnailURL',
  'url',
  'sizes',
])

export type FieldInfo = {
  name: string
  type: string
  required: boolean
  localized: boolean
  unique: boolean
  hidden: boolean
  relationTo?: string
  /** Message the field's own validator returns for a value that violates it, if any. */
  formatRule?: string
  /** Probe values the validator accepted, for the matrix's happy path. */
  acceptsRelative?: boolean
}

export type PageInfo = {
  page: string
  kind: 'global' | 'collection'
  adminUrl: string
  /** `[data-section="…"]` block on the public page, when the frontend renders one. */
  section: string | null
  fields: FieldInfo[]
}

export type Inventory = {
  locales: string[]
  /** Present only if the config enables drafts. Absent means draft/publish states do not exist to test. */
  versions: string[]
  /** Fields on the auth collection that could gate per-role access. Empty means no roles exist. */
  roleFields: string[]
  pages: PageInfo[]
}

const BAD_URL = 'not a url at all'

async function probe(field: Field, value: unknown): Promise<string | null> {
  const validate = (field as { validate?: unknown }).validate
  if (typeof validate !== 'function') return null
  try {
    // Payload's field validators take (value, options); the custom ones in this
    // config only read the value. A built-in that needs more of the options bag
    // throws, and a throw is not a validation message — hence the catch.
    const result = await (validate as (v: unknown, o: unknown) => unknown)(value, {
      siblingData: {},
      data: {},
      operation: 'update',
      req: { t: (k: string) => k, payload: {} },
    })
    return typeof result === 'string' ? result : null
  } catch {
    return null
  }
}

async function describeField(field: Field): Promise<FieldInfo | null> {
  const name = (field as { name?: string }).name
  if (!name || AUTO.has(name)) return null
  const f = field as Record<string, unknown>
  const info: FieldInfo = {
    name,
    type: field.type,
    required: Boolean(f.required),
    localized: Boolean(f.localized),
    unique: Boolean(f.unique),
    hidden: Boolean((f.admin as { hidden?: boolean } | undefined)?.hidden),
    ...(f.relationTo ? { relationTo: String(f.relationTo) } : {}),
  }
  if (field.type === 'text') {
    const rejection = await probe(field, BAD_URL)
    if (rejection) {
      info.formatRule = rejection
      info.acceptsRelative = (await probe(field, '/ok')) === null
    }
  }
  return info
}

async function describe(
  entity: { slug: string; fields: Field[] },
  kind: 'global' | 'collection',
  sections: Set<string>,
): Promise<PageInfo> {
  const fields = (await Promise.all(entity.fields.map(describeField))).filter(
    (f): f is FieldInfo => f !== null,
  )
  return {
    page: entity.slug,
    kind,
    adminUrl:
      kind === 'global' ? `/admin/globals/${entity.slug}` : `/admin/collections/${entity.slug}`,
    // A collection has no section of its own: `NavigationItem` rows render
    // inside `[data-section="Navigation"]`. Longest prefix wins, so
    // `FeaturesCarouselItem` resolves to `FeaturesCarousel` rather than to a
    // shorter section name that also happens to be a prefix.
    section:
      [...sections]
        .filter((s) => entity.slug === s || entity.slug.startsWith(s))
        .sort((a, b) => b.length - a.length)[0] ?? null,
    fields,
  }
}

export async function buildInventory(
  config: SanitizedConfig,
  sections: Set<string>,
): Promise<Inventory> {
  const auth = config.collections.find((c) => c.slug === config.admin?.user)
  return {
    locales: (config.localization && 'locales' in config.localization
      ? config.localization.locales.map((l) => (typeof l === 'string' ? l : l.code))
      : ['en']) as string[],
    versions: config.globals.filter((g) => g.versions).map((g) => g.slug),
    roleFields: (auth?.fields ?? [])
      .map((f) => f as { name?: string; type: string })
      .filter((f) => f.name && !AUTO.has(f.name) && (f.type === 'select' || /role/i.test(f.name)))
      .map((f) => f.name as string),
    pages: [
      ...(await Promise.all(config.globals.map((g) => describe(g, 'global', sections)))),
      ...(await Promise.all(
        config.collections
          // `payload-*` are Payload's own bookkeeping tables, which the admin
          // panel does not list. The auth collection and the upload bucket are
          // exercised by e2e/admin.spec.ts and the media parity report; a field
          // matrix over `users` would mostly be testing Payload's login form.
          .filter(
            (c) =>
              c.slug !== config.admin?.user && c.slug !== 'media' && !c.slug.startsWith('payload-'),
          )
          .map((c) => describe(c, 'collection', sections)),
      )),
    ],
  }
}

/** Sections the frontend renders, read off the components that render them. */
export async function renderedSections(dir: string): Promise<Set<string>> {
  const { readdirSync, readFileSync } = await import('node:fs')
  const path = await import('node:path')
  const found = new Set<string>()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.tsx')) continue
    for (const m of readFileSync(path.join(dir, file), 'utf8').matchAll(
      /data-section="([^"]+)"/g,
    )) {
      found.add(m[1])
    }
  }
  return found
}

export type Case = {
  id: string
  /** happy | boundary | negative | injection | persistence */
  kind: 'happy' | 'boundary' | 'negative' | 'injection'
  /** Value typed into the admin form. */
  value: string
  /** What the run must observe. */
  expect: 'saves' | 'rejected'
  why: string
}

const LONG = 'L'.repeat(5000)

/**
 * The edge-case checklist, applied to every field the inventory found. It is a
 * function of the field's discovered shape rather than a list per page, so a
 * field added to the manifest tomorrow is covered without anyone editing this.
 */
export function casesFor(field: FieldInfo): Case[] {
  if (field.type === 'number') {
    return [
      {
        id: 'happy',
        kind: 'happy',
        value: '7',
        why: 'a plain integer saves and persists',
        expect: 'saves',
      },
      {
        id: 'zero',
        kind: 'boundary',
        value: '0',
        why: 'zero is a value, not an absence — it must not be dropped as falsy',
        expect: 'saves',
      },
      {
        id: 'negative',
        kind: 'boundary',
        value: '-1',
        why: 'no lower bound is configured, so -1 must save rather than fail silently',
        expect: 'saves',
      },
    ]
  }
  if (field.type !== 'text') return []
  const cases: Case[] = [
    {
      id: 'happy',
      kind: 'happy',
      value: field.formatRule ? '/happy-path' : 'Happy path value',
      why: 'a valid value saves and reaches the public page',
      expect: 'saves',
    },
    {
      id: 'empty',
      kind: 'boundary',
      value: '',
      why: `${field.required ? 'the field is required, so an empty value must be refused' : 'the field is optional, so an empty value must save rather than error'}`,
      expect: field.required ? 'rejected' : 'saves',
    },
    {
      id: 'whitespace',
      kind: 'boundary',
      value: '   ',
      // A format-validated field refuses this, and correctly: whitespace is a
      // value, not an absence, so the validator sees `"   "` and none of the
      // shapes it accepts. The first run of this matrix expected a save here and
      // the failure was the generator's, not the CMS's.
      why: field.formatRule
        ? `whitespace-only is a value, not an absence, so the format rule must refuse it: ${field.formatRule}`
        : 'whitespace-only must not be silently coerced to empty or to a trimmed value the editor did not type',
      expect: field.required || field.formatRule ? 'rejected' : 'saves',
    },
    {
      id: 'unicode',
      kind: 'boundary',
      value: field.formatRule
        ? '/caf\u00e9-\ud83d\ude80'
        : 'Caf\u00e9 \u2014 \u5e83\u544a \u2014 \ud83d\ude80\ud83c\udf89',
      why: 'accented, CJK and astral-plane characters must round-trip byte-for-byte',
      expect: 'saves',
    },
    {
      id: 'special',
      kind: 'boundary',
      value: field.formatRule
        ? '/a\'b"c&d'
        : `Ampersand & quote " apostrophe ' angle < > backslash \\ percent %`,
      why: 'characters that need escaping in HTML, SQL and URLs must round-trip unescaped',
      expect: 'saves',
    },
    {
      id: 'long',
      kind: 'boundary',
      value: field.formatRule ? `/${LONG}` : LONG,
      why: 'no maxLength is configured, so 5000 characters must either save whole or be refused — never truncated silently',
      expect: 'saves',
    },
    {
      id: 'injection',
      kind: 'injection',
      value: field.formatRule
        ? '/x?y=<script>alert(1)</script>'
        : '<script>alert(1)</script><img src=x onerror=alert(2)>',
      why: 'must be stored verbatim and rendered as text — no script or img element may appear in the section',
      expect: 'saves',
    },
  ]
  if (field.formatRule) {
    cases.push(
      {
        id: 'format-bad',
        kind: 'negative',
        value: 'not a url at all',
        why: `must be refused: ${field.formatRule}`,
        expect: 'rejected',
      },
      {
        id: 'format-anchor',
        kind: 'happy',
        value: '#anchor',
        why: 'an anchor is one of the three accepted shapes',
        expect: 'saves',
      },
      {
        id: 'format-absolute',
        kind: 'happy',
        value: 'https://example.com/p?q=1',
        why: 'an absolute URL is one of the three accepted shapes',
        expect: 'saves',
      },
      // Characterization, not aspiration: the validator's `^\/` branch accepts
      // `//example.com`, so a value that navigates off-site passes as a
      // "relative path". The case asserts the behaviour that exists — tighten
      // the regex and this fails, which is the only way such a change gets
      // noticed. Recorded as a known gap in the skill.
      {
        id: 'format-protocol-relative',
        kind: 'boundary',
        value: '//example.com',
        why: 'documents that the validator accepts a protocol-relative URL as a relative path (known gap)',
        expect: 'saves',
      },
    )
  }
  return cases
}

export function fieldMatrixMarkdown(page: PageInfo): string {
  const rows: string[] = [
    `# Field matrix — ${page.page} (${page.kind})`,
    '',
    `Admin: \`${page.adminUrl}\`  •  Public section: ${page.section ? `\`[data-section="${page.section}"]\`` : '**not rendered on the public page**'}`,
    '',
    '| Field | Type | Case | Kind | Expect | Value | Why |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ]
  const skipped: string[] = []
  for (const field of page.fields) {
    const cases = casesFor(field)
    if (!cases.length) {
      skipped.push(`\`${field.name}\` (${field.type}) — no case template for this field type`)
      continue
    }
    for (const c of cases) {
      const shown =
        c.value.length > 40
          ? `${c.value.slice(0, 37)}… (${c.value.length} chars)`
          : c.value || '(empty)'
      rows.push(
        `| \`${field.name}\` | ${field.type}${field.localized ? ', localized' : ''}${field.required ? ', required' : ''} | ${c.id} | ${c.kind} | ${c.expect} | \`${shown.replace(/\|/g, '\\|')}\` | ${c.why} |`,
      )
    }
  }
  rows.push('', '## Fields with no cases generated', '')
  rows.push(skipped.length ? skipped.map((s) => `- ${s}`).join('\n') : '- none')
  return rows.join('\n') + '\n'
}
