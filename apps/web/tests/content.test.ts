import { buildConfig, getPayload as getPayloadClient, type BasePayload } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { afterAll, describe, expect, it } from 'vitest'
import { createContentApi, DEFAULT_LOCALE, getGlobal, getCollection } from '@/lib/content'

describe('DEFAULT_LOCALE', () => {
  it('defaults to en', () => {
    expect(DEFAULT_LOCALE).toBe('en')
  })
})

describe('getGlobal / getCollection against the seeded app content', () => {
  it('reads and resolves a seeded global', async () => {
    const header = await getGlobal('Header', 'en')
    expect(header.headline).toBe('Browse everything.')
  })

  it('resolves every row of a seeded collection', async () => {
    const items = await getCollection('BenefitsItem', 'en')
    expect(items).toHaveLength(4)
    expect(items.map((item) => item.title)).toContain('Amplify Insights')
  })
})

/**
 * `getGlobal`/`getCollection` are generic over the Payload client
 * (`createContentApi`), so the fallback behaviour that used to live in
 * `strip()` (Phase 1) can be proven directly against a real Payload
 * instance, without needing a second locale in the real site manifest.
 */
describe('locale fallback (Payload-side, replaces Phase 1 strip())', () => {
  const config = buildConfig({
    secret: 'test',
    editor: lexicalEditor(),
    db: sqliteAdapter({ client: { url: ':memory:' } }),
    localization: { locales: ['en', 'id'], defaultLocale: 'en' },
    collections: [
      { slug: 'users', auth: true, fields: [] },
      {
        slug: 'Samples',
        fields: [{ name: 'title', type: 'text', localized: true }],
      },
    ],
    globals: [
      {
        slug: 'Sample',
        fields: [
          { name: 'headline', type: 'text', localized: true },
          { name: 'ctaHref', type: 'text' },
        ],
      },
    ],
  })

  let cached: Promise<BasePayload> | undefined
  const getClient = () => (cached ??= getPayloadClient({ config, key: 'fallback-test' }))
  const api = createContentApi(getClient)

  afterAll(async () => {
    const payload = await getClient()
    await payload.destroy()
  })

  it('returns the requested locale when present', async () => {
    const payload = await getClient()
    await payload.updateGlobal({
      slug: 'Sample',
      locale: 'en',
      data: { headline: 'Launch', ctaHref: '/signup' },
    })
    await payload.updateGlobal({
      slug: 'Sample',
      locale: 'id',
      data: { headline: 'Peluncuran' },
    })

    expect(await api.getGlobal('Sample', 'id')).toMatchObject({ headline: 'Peluncuran' })
  })

  it('falls back to en when the requested locale is missing, for a global', async () => {
    const result = await api.getGlobal('Sample', 'id')
    expect(result.ctaHref).toBe('/signup')
  })

  it('falls back to en when the requested locale is missing, for a collection', async () => {
    const payload = await getClient()
    await payload.create({ collection: 'Samples', locale: 'en', data: { title: 'First' } })

    const items = await api.getCollection('Samples', 'id')
    expect(items).toEqual([expect.objectContaining({ title: 'First' })])
  })
})
