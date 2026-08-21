import { describe, expect, it } from 'vitest'
import {
  buildSnapshot,
  checkTranslatableFlips,
  generateConfigSource,
  loadManifest,
} from '@/scripts/gen-cms'
import type { Manifest } from '@/schemas/manifest'

const manifest: Manifest = {
  locales: ['en'],
  tokens: {},
  sections: [
    {
      name: 'Hero',
      kind: 'global',
      fields: [
        { name: 'headline', type: 'text', translatable: true },
        { name: 'ctaHref', type: 'url', translatable: false },
      ],
    },
    {
      name: 'Item',
      kind: 'collection',
      fields: [{ name: 'title', type: 'text', translatable: true }],
    },
  ],
}

describe('buildSnapshot', () => {
  it('keys every field by Section.field', () => {
    expect(buildSnapshot(manifest)).toEqual({
      'Hero.headline': true,
      'Hero.ctaHref': false,
      'Item.title': true,
    })
  })
})

describe('checkTranslatableFlips', () => {
  it('is silent when nothing changed', () => {
    const snapshot = buildSnapshot(manifest)
    expect(() => checkTranslatableFlips(snapshot, snapshot)).not.toThrow()
  })

  it('is silent for a brand-new field with no prior entry', () => {
    expect(() => checkTranslatableFlips({}, buildSnapshot(manifest))).not.toThrow()
  })

  it('refuses when an existing field flips translatable', () => {
    const previous = { 'Hero.headline': true }
    const next = { 'Hero.headline': false }
    expect(() => checkTranslatableFlips(previous, next)).toThrow(/Hero.headline/)
  })
})

describe('generateConfigSource', () => {
  it('is byte-identical across repeated runs for the same manifest', () => {
    expect(generateConfigSource(manifest)).toBe(generateConfigSource(manifest))
  })

  it('emits localized: true only for translatable fields', () => {
    const source = generateConfigSource(manifest)
    expect(source).toMatch(/name: 'headline',\s*type: 'text',\s*localized: true,/)
    const ctaHrefBlock = source.slice(source.indexOf("name: 'ctaHref'"))
    expect(ctaHrefBlock.slice(0, 200)).not.toContain('localized: true')
  })

  it('places kind: global sections under globals and kind: collection under collections', () => {
    const source = generateConfigSource(manifest)
    const globalsBlock = source.slice(source.indexOf('globals:'))
    expect(globalsBlock).toContain("slug: 'Hero'")
    expect(globalsBlock).not.toContain("slug: 'Item'")
  })

  it('generates one localization locale entry per manifest locale, defaulting to the first', () => {
    const source = generateConfigSource({ ...manifest, locales: ['en', 'id'] })
    expect(source).toContain("locales: ['en', 'id']")
    expect(source).toContain("defaultLocale: 'en'")
  })
})

describe('loadManifest', () => {
  it('parses and validates the real site.manifest.json', () => {
    const real = loadManifest()
    expect(real.locales[0]).toBe('en')
    expect(real.sections.length).toBeGreaterThan(0)
  })
})
