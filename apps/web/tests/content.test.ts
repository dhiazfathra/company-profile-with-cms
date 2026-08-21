import { describe, expect, it } from 'vitest'
import { strip, getGlobal, getCollection, DEFAULT_LOCALE } from '@/lib/content'

describe('strip', () => {
  it('drops the suffix for the requested locale', () => {
    expect(strip({ headline_en: 'Launch' })).toEqual({ headline: 'Launch' })
  })

  it('leaves untranslatable keys untouched', () => {
    expect(strip({ headline_en: 'Launch', ctaHref: '/signup' }))
      .toEqual({ headline: 'Launch', ctaHref: '/signup' })
  })

  it('returns the requested locale when present', () => {
    expect(strip({ headline_en: 'Launch', headline_id: 'Peluncuran' }, 'id'))
      .toEqual({ headline: 'Peluncuran' })
  })

  it('falls back to en when the requested locale is missing', () => {
    expect(strip({ headline_en: 'Launch' }, 'id')).toEqual({ headline: 'Launch' })
  })

  it('prefers the requested locale regardless of key order', () => {
    expect(strip({ headline_id: 'Peluncuran', headline_en: 'Launch' }, 'id'))
      .toEqual({ headline: 'Peluncuran' })
    expect(strip({ headline_en: 'Launch', headline_id: 'Peluncuran' }, 'id'))
      .toEqual({ headline: 'Peluncuran' })
  })

  it('ignores locales that are neither requested nor the default', () => {
    expect(strip({ headline_en: 'Launch', headline_de: 'Start' }, 'id'))
      .toEqual({ headline: 'Launch' })
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
