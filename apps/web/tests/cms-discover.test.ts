import { describe, expect, it } from 'vitest'
import type { Field, SanitizedConfig } from 'payload'
import {
  buildInventory,
  casesFor,
  fieldMatrixMarkdown,
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
    expect(ids).toEqual(['happy', 'zero', 'negative'])
  })

  it('generates nothing for a field type with no template, rather than a fake case', () => {
    expect(casesFor(text({ type: 'upload', relationTo: 'media' }))).toEqual([])
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
