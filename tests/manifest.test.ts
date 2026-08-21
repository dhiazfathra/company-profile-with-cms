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
    expect(() => ManifestSchema.parse(bad)).toThrow(/locales\[0\] must be/)
  })

  it('rejects duplicate section names', () => {
    const bad = { ...valid, sections: [valid.sections[0], valid.sections[0]] }
    expect(() => ManifestSchema.parse(bad)).toThrow(/duplicate section name/i)
  })

  it('rejects duplicate field names within a section', () => {
    const bad = {
      ...valid,
      sections: [{
        ...valid.sections[0],
        fields: [valid.sections[0].fields[0], valid.sections[0].fields[0]],
      }],
    }
    expect(() => ManifestSchema.parse(bad)).toThrow(/duplicate field name/i)
  })

  it('rejects a field name that already carries a locale suffix', () => {
    const bad = {
      ...valid,
      sections: [{
        ...valid.sections[0],
        fields: [{ name: 'headline_en', type: 'text', translatable: true }],
      }],
    }
    expect(() => ManifestSchema.parse(bad)).toThrow(/must not include a locale suffix/i)
  })

  it('rejects a section with no fields', () => {
    const bad = { ...valid, sections: [{ ...valid.sections[0], fields: [] }] }
    expect(() => ManifestSchema.parse(bad)).toThrow()
  })
})
