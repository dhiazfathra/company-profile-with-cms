import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
})

async function loadConfig() {
  vi.resetModules()
  return import('@/payload.config')
}

/**
 * The gap this guards is the one that shipped: media rows in the remote
 * database, media files on the laptop that ran the seed, every <img> 500ing
 * from /api/media/file/... on a deployment whose build was green. A production
 * build without blob storage configured must fail rather than produce that.
 */
describe('media blob storage', () => {
  it('throws in production when BLOB_READ_WRITE_TOKEN is unset', async () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    vi.stubEnv('NODE_ENV', 'production')
    await expect(loadConfig()).rejects.toThrow(/BLOB_READ_WRITE_TOKEN must be set in production/)
  })

  it('falls back to local disk uploads outside production', async () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    vi.stubEnv('NODE_ENV', 'test')
    const resolved = await (await loadConfig()).default
    expect(resolved.upload?.adapter).toBeUndefined()
  })

  it('registers the blob adapter for media when the token is set', async () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test_token')
    vi.stubEnv('NODE_ENV', 'production')
    const resolved = await (await loadConfig()).default
    const media = resolved.collections.find((c) => c.slug === 'media')
    expect(media?.upload).toMatchObject({ disableLocalStorage: true })
  })
})
