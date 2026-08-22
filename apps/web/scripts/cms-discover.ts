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

/** Payload writes these on every document, whatever the collection is. */
const AUTO = new Set(['id', 'createdAt', 'updatedAt'])

/**
 * Written by Payload's upload handling — but only on a collection that declares
 * `upload`. Dropping them everywhere would silently delete an editor's own
 * field from the matrix for the crime of being called `url`, and a field the
 * matrix never heard of is a field the report claims nothing about.
 */
const UPLOAD_MANAGED = new Set([
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
  /**
   * The cases `casesFor` generated, written into `inventory.json` by
   * `cms-discover-cli.ts`.
   *
   * Two consumers need them and neither can call the generator. The report has
   * to tell "no case template for this field type" apart from "the field's first
   * case failed, so it logged nothing" — the two used to be indistinguishable,
   * and it printed the first explanation for both. And the QA artefacts
   * (`cms-to-qa`) describe every case, run or not, so the scenario sheet's
   * denominator is the whole matrix rather than the part that executed.
   *
   * The full case — value included — rather than a count or a summary. A second,
   * shorter description of the test data beside it is a description that can
   * drift from the value the browser actually types.
   */
  cases?: Case[]
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
  /**
   * Every upload collection and the limits it declares. Read rather than
   * assumed: the report used to state as fact that `media` configures no
   * `mimeTypes` or `filesize`, which would have stayed in the report after
   * somebody added one.
   */
  uploads: { collection: string; mimeTypes: string[] | null; filesize: number | null }[]
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

async function describeField(field: Field, isUpload: boolean): Promise<FieldInfo | null> {
  const name = (field as { name?: string }).name
  if (!name || AUTO.has(name)) return null
  if (isUpload && UPLOAD_MANAGED.has(name)) return null
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
  entity: { slug: string; fields: Field[]; upload?: unknown },
  kind: 'global' | 'collection',
  sections: Set<string>,
): Promise<PageInfo> {
  const isUpload = Boolean(entity.upload)
  const fields = (
    await Promise.all(entity.fields.map((field) => describeField(field, isUpload)))
  ).filter((f): f is FieldInfo => f !== null)
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
    // Globals *and* collections. The report says "no global or collection in
    // this config enables versions" whenever this is empty, and a claim that
    // only looked at half the config would be a false one.
    versions: [
      ...config.globals.filter((g) => g.versions).map((g) => g.slug),
      ...config.collections.filter((c) => c.versions).map((c) => c.slug),
    ],
    uploads: config.collections
      .filter((c) => c.upload)
      .map((c) => {
        const upload = c.upload as { mimeTypes?: string[]; filesize?: number }
        return {
          collection: c.slug,
          mimeTypes: upload?.mimeTypes ?? null,
          filesize: typeof upload?.filesize === 'number' ? upload.filesize : null,
        }
      }),
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

/**
 * Sections the frontend renders, read off the components that render them.
 *
 * Walks subdirectories by hand rather than passing `recursive` to `readdirSync`:
 * that option arrived in Node 20.1 and was removed again in Node 25, and this
 * repository's `engines` allows both. A component moved one directory down would
 * otherwise drop out of the scan, and the page it renders would be reported as
 * having no public section at all.
 */
export async function renderedSections(dir: string): Promise<Set<string>> {
  const { readdirSync, readFileSync } = await import('node:fs')
  const path = await import('node:path')
  const found = new Set<string>()
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!entry.name.endsWith('.tsx')) continue
      for (const m of readFileSync(full, 'utf8').matchAll(/data-section="([^"]+)"/g)) {
        found.add(m[1])
      }
    }
  }
  walk(dir)
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

/**
 * A token unique to one field, mixed into every value whose arrival on the
 * public page the run checks.
 *
 * Without it the values are module constants — `'Happy path value'` for every
 * text field of every page — and the public-page check is
 * `html.includes(value)` against the whole document served for `/`. Two pages
 * running at once therefore let page B find page A's identical string and record
 * `renderedOnPublicPage: true` for a field that renders nothing: a false pass on
 * the one check this suite exists for. It is also worth having in a sequential
 * run, where a value that appears in `/` is now unambiguously *this* field's
 * rather than any field that happens to share its text.
 *
 * Lower-case and hyphenated so it stays valid inside a path or an anchor, which
 * is what the format-validated fields need.
 */
const salt = (scope: string, field: string) =>
  `${scope}-${field}`.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()

/** 5000 characters exactly, with the field's own token at the front. */
const longValue = (token: string) => {
  const head = `${token}-`
  return head + 'L'.repeat(Math.max(0, 5000 - head.length))
}

/**
 * The edge-case checklist, applied to every field the inventory found. It is a
 * function of the field's discovered shape rather than a list per page, so a
 * field added to the manifest tomorrow is covered without anyone editing this.
 */
export function casesFor(field: FieldInfo, scope = ''): Case[] {
  // Defaults to the field name alone so an existing single-page caller still
  // gets unique-per-field values; `--concurrency` needs the page too, which is
  // why every call site in the suite passes it.
  const token = salt(scope, field.name)
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
      // The text branch has always covered these two; the number branch did not,
      // so a required number field got no rejection case and still read as
      // fully covered in the matrix — three cases, no gap visible.
      {
        id: 'empty',
        kind: 'boundary',
        value: '',
        why: field.required
          ? 'the field is required, so an empty value must be refused'
          : 'the field is optional, so an empty value must save rather than error',
        expect: field.required ? 'rejected' : 'saves',
      },
      // No "text in a number field" case: the admin renders `input[type=number]`
      // and Playwright's `fill` refuses to type letters into one, so the case
      // would fail on the tool rather than on the CMS.
    ]
  }
  if (field.type !== 'text') return []
  const cases: Case[] = [
    {
      id: 'happy',
      kind: 'happy',
      value: field.formatRule ? `/happy-path-${token}` : `Happy path value ${token}`,
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
        ? `/caf\u00e9-\ud83d\ude80-${token}`
        : `Caf\u00e9 \u2014 \u5e83\u544a \u2014 \ud83d\ude80\ud83c\udf89 ${token}`,
      why: 'accented, CJK and astral-plane characters must round-trip byte-for-byte',
      expect: 'saves',
    },
    {
      id: 'special',
      kind: 'boundary',
      value: field.formatRule
        ? `/a'b"c&d-${token}`
        : `Ampersand & quote " apostrophe ' angle < > backslash \\ percent % ${token}`,
      why: 'characters that need escaping in HTML, SQL and URLs must round-trip unescaped',
      expect: 'saves',
    },
    {
      id: 'long',
      kind: 'boundary',
      value: field.formatRule ? `/${longValue(token)}` : longValue(token),
      // States only what the case asserts. The `why` is quoted into the test
      // title and into the failure message, and the old wording ("or be
      // refused") told a reader that a refusal was acceptable directly beside an
      // assertion that treated the refusal as the defect.
      why: 'no maxLength is configured, so 5000 characters must save whole — never truncated, never refused',
      expect: 'saves',
    },
    {
      id: 'injection',
      kind: 'injection',
      value: field.formatRule
        ? `/x?y=<script>alert(1)</script>-${token}`
        : `<script>alert(1)</script><img src=x onerror=alert(2)>${token}`,
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
        value: `#anchor-${token}`,
        why: 'an anchor is one of the three accepted shapes',
        expect: 'saves',
      },
      {
        id: 'format-absolute',
        kind: 'happy',
        value: `https://example.com/p?q=1-${token}`,
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
        value: `//example.com/${token}`,
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
    const cases = casesFor(field, page.page)
    if (!cases.length) {
      skipped.push(`\`${field.name}\` (${field.type}) — no case template for this field type`)
      continue
    }
    if (field.hidden) {
      // `admin.hidden` means the panel renders no input, so a form-driven case
      // fails on a missing locator and says nothing about the CMS.
      skipped.push(
        `\`${field.name}\` (${field.type}) — hidden from the admin form (\`admin.hidden\`), so it cannot be driven through the panel`,
      )
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
