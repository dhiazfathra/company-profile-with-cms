import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Field, SanitizedConfig } from 'payload'
import {
  buildInventory,
  casesFor,
  fieldMatrixMarkdown,
  renderedSections,
  type FieldInfo,
} from '../scripts/cms-discover'

const text = (over: Partial<FieldInfo> = {}): FieldInfo => ({
  name: 'label',
  type: 'text',
  required: false,
  localized: true,
  unique: false,
  hidden: false,
  ...over,
})

const byId = (field: FieldInfo) => new Map(casesFor(field).map((c) => [c.id, c]))

describe('casesFor', () => {
  it('covers happy, boundary and injection for a plain optional text field', () => {
    const ids = [...byId(text()).keys()]
    expect(ids).toEqual(['happy', 'empty', 'whitespace', 'unicode', 'special', 'long', 'injection'])
  })

  it('requires a save for an empty optional field and a refusal for an empty required one', () => {
    expect(byId(text()).get('empty')?.expect).toBe('saves')
    expect(byId(text({ required: true })).get('empty')?.expect).toBe('rejected')
  })

  it('expects a format-validated field to refuse whitespace, which is a value and not an absence', () => {
    // The regression this pins: the first version expected a save here, and the
    // failing case was the generator's fault rather than the CMS's.
    const cases = byId(text({ formatRule: 'Must be a relative path' }))
    expect(cases.get('whitespace')?.expect).toBe('rejected')
    expect(cases.get('whitespace')?.why).toContain('Must be a relative path')
    expect(byId(text()).get('whitespace')?.expect).toBe('saves')
  })

  it('adds the format cases, and only for a field whose validator rejected the probe', () => {
    const withRule = byId(text({ formatRule: 'Must be a URL' }))
    expect([...withRule.keys()]).toContain('format-bad')
    expect(withRule.get('format-bad')?.expect).toBe('rejected')
    expect(withRule.get('format-absolute')?.expect).toBe('saves')
    // Characterization, not aspiration — the validator accepts `//example.com`.
    expect(withRule.get('format-protocol-relative')?.expect).toBe('saves')
    expect([...byId(text()).keys()]).not.toContain('format-bad')
  })

  it('keeps every value for a format-validated field inside a shape that validator accepts', () => {
    const accepted = /^(\/|#|https?:\/\/)/
    for (const kase of casesFor(text({ formatRule: 'Must be a URL' }))) {
      if (kase.expect !== 'saves' || kase.value === '') continue
      expect(accepted.test(kase.value), `${kase.id} would be refused: ${kase.value}`).toBe(true)
    }
  })

  it('sends 5000 characters, so a silent truncation has something to truncate', () => {
    expect(byId(text()).get('long')?.value.length).toBe(5000)
  })

  it('covers zero for a number field, because falsy is not absent', () => {
    const ids = [...byId(text({ type: 'number' })).keys()]
    expect(ids).toEqual(['happy', 'zero', 'negative', 'empty'])
  })

  it('gives a required number field a rejection case, as the text branch always did', () => {
    // The gap this closes was invisible in the report: three cases looked like
    // full coverage for a field with no empty-input check at all.
    expect(byId(text({ type: 'number' })).get('empty')?.expect).toBe('saves')
    expect(byId(text({ type: 'number', required: true })).get('empty')?.expect).toBe('rejected')
  })

  it('states only the asserted behaviour in the long case reason', () => {
    // The `why` is quoted into the test title and the failure message, so wording
    // that allows a refusal beside an assertion that fails on one misleads twice.
    const long = byId(text()).get('long')
    expect(long?.expect).toBe('saves')
    expect(long?.why).not.toContain('or be refused')
  })

  it('generates nothing for a field type with no template, rather than a fake case', () => {
    expect(casesFor(text({ type: 'upload', relationTo: 'media' }))).toEqual([])
  })
})

describe('renderedSections', () => {
  it('finds a section in a nested directory, so a moved component is not reported as unrendered', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sections-'))
    mkdirSync(path.join(dir, 'hero'), { recursive: true })
    writeFileSync(path.join(dir, 'Footer.tsx'), '<section data-section="Footer">')
    writeFileSync(path.join(dir, 'hero', 'Header.tsx'), '<section data-section="Header">')
    writeFileSync(path.join(dir, 'notes.md'), 'data-section="NotAComponent"')
    // `recursive: true` on readdirSync is not an option here: it landed in Node
    // 20.1 and was removed in Node 25, and `engines` allows both.
    await expect(renderedSections(dir)).resolves.toEqual(new Set(['Footer', 'Header']))
  })
})

describe('fieldMatrixMarkdown', () => {
  const page = {
    page: 'Header',
    kind: 'global' as const,
    adminUrl: '/admin/globals/Header',
    section: 'Header',
    fields: [text({ name: 'headline' }), text({ name: 'image', type: 'upload' })],
  }

  it('names every field it generated no cases for, instead of leaving them out', () => {
    const md = fieldMatrixMarkdown(page)
    expect(md).toContain('`headline`')
    expect(md).toContain('## Fields with no cases generated')
    expect(md).toMatch(/- `image` \(upload\)/)
  })

  it('says so when the page renders no section, rather than showing an empty selector', () => {
    expect(fieldMatrixMarkdown({ ...page, section: null })).toContain(
      '**not rendered on the public page**',
    )
  })
})

describe('buildInventory', () => {
  const config = {
    admin: { user: 'users' },
    localization: { locales: ['en'], defaultLocale: 'en' },
    globals: [{ slug: 'Header', fields: [{ name: 'headline', type: 'text' }] }],
    collections: [
      { slug: 'users', auth: true, fields: [{ name: 'email', type: 'email' }] },
      { slug: 'media', upload: true, fields: [] },
      { slug: 'payload-preferences', fields: [] },
      { slug: 'HeaderItem', fields: [{ name: 'label', type: 'text' }] },
    ],
  } as unknown as SanitizedConfig

  it('leaves out the auth collection, the media bucket and Payload’s own tables', async () => {
    const inventory = await buildInventory(config, new Set(['Header']))
    expect(inventory.pages.map((p) => p.page)).toEqual(['Header', 'HeaderItem'])
  })

  it('resolves a collection to the section its rows render inside', async () => {
    const inventory = await buildInventory(config, new Set(['Header']))
    expect(inventory.pages.find((p) => p.page === 'HeaderItem')?.section).toBe('Header')
  })

  it('reports the absence of versions and roles, which is what makes those cases inapplicable', async () => {
    const inventory = await buildInventory(config, new Set(['Header']))
    expect(inventory.versions).toEqual([])
    expect(inventory.roleFields).toEqual([])
    expect(inventory.locales).toEqual(['en'])
  })

  it('records the message a field’s own validator returns, which is how a URL field is recognised', async () => {
    const href: Field = {
      name: 'href',
      type: 'text',
      validate: (value: unknown) =>
        !value || /^(\/|#|https?:\/\/)/.test(String(value)) || 'Must be a relative path',
    } as Field
    const withHref = {
      ...config,
      globals: [{ slug: 'Header', fields: [href] }],
    } as unknown as SanitizedConfig
    const inventory = await buildInventory(withHref, new Set(['Header']))
    const field = inventory.pages[0].fields[0]
    expect(field.formatRule).toBe('Must be a relative path')
    expect(field.acceptsRelative).toBe(true)
  })

  it('keeps an editor-authored field named like an upload field when the collection is not an upload', async () => {
    // `url`, `sizes`, `filename` and friends are Payload's only on a collection
    // that declares `upload`. Dropping them everywhere deleted a real field from
    // the matrix, and a field the matrix never heard of is one the report makes
    // no claim about either way.
    const withUrl = {
      ...config,
      globals: [{ slug: 'Header', fields: [{ name: 'url', type: 'text' }] }],
    } as unknown as SanitizedConfig
    const inventory = await buildInventory(withUrl, new Set(['Header']))
    expect(inventory.pages[0].fields.map((f) => f.name)).toEqual(['url'])
  })

  it('drops upload-managed fields on a collection that does declare upload', async () => {
    const withUpload = {
      ...config,
      globals: [],
      collections: [
        { slug: 'users', auth: true, fields: [] },
        {
          slug: 'Attachments',
          upload: { mimeTypes: ['image/png'], filesize: 1024 },
          fields: [
            { name: 'url', type: 'text' },
            { name: 'caption', type: 'text' },
          ],
        },
      ],
    } as unknown as SanitizedConfig
    const inventory = await buildInventory(withUpload, new Set())
    expect(inventory.pages[0].fields.map((f) => f.name)).toEqual(['caption'])
  })

  it('reads the upload limits instead of letting the report assert there are none', async () => {
    const withUpload = {
      ...config,
      collections: [
        { slug: 'users', auth: true, fields: [] },
        { slug: 'media', upload: { mimeTypes: ['image/png'], filesize: 4096 }, fields: [] },
      ],
    } as unknown as SanitizedConfig
    const inventory = await buildInventory(withUpload, new Set(['Header']))
    expect(inventory.uploads).toEqual([
      { collection: 'media', mimeTypes: ['image/png'], filesize: 4096 },
    ])
  })

  it('finds versions on a collection, not only on a global', async () => {
    // The report says "no global or collection enables versions" when this is
    // empty, so a scan of half the config would put a false claim in evidence.
    const withVersions = {
      ...config,
      collections: [
        { slug: 'users', auth: true, fields: [] },
        { slug: 'Posts', versions: { drafts: true }, fields: [{ name: 'title', type: 'text' }] },
      ],
    } as unknown as SanitizedConfig
    const inventory = await buildInventory(withVersions, new Set())
    expect(inventory.versions).toEqual(['Posts'])
  })

  it('drops the fields Payload writes itself, which no editor types into', async () => {
    const withAuto = {
      ...config,
      globals: [
        {
          slug: 'Header',
          fields: [
            { name: 'headline', type: 'text' },
            { name: 'updatedAt', type: 'date' },
            { name: 'createdAt', type: 'date' },
          ],
        },
      ],
    } as unknown as SanitizedConfig
    const inventory = await buildInventory(withAuto, new Set(['Header']))
    expect(inventory.pages[0].fields.map((f) => f.name)).toEqual(['headline'])
  })
})
