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
    expect(resolved.upload.adapters).toEqual([])
  })

  it('registers the blob adapter for media when the token is set', async () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_test_token')
    vi.stubEnv('NODE_ENV', 'production')
    const resolved = await (await loadConfig()).default
    const media = resolved.collections.find((c) => c.slug === 'media')
    expect(media?.upload).toMatchObject({ disableLocalStorage: true })
  })

  /**
   * The second gap, and the one that shipped after the first: the plugin used
   * to be dropped from `plugins` when the token was absent, which also dropped
   * its admin client component from `admin.dependencies`. The import map is
   * generated where the token is not set and committed, so production asked
   * the map for a component nobody had written into it and /admin rendered
   * blank — with a green build. The handler must be registered either way.
   */
  it.each([
    ['without a token', ''],
    ['with a token', 'vercel_blob_rw_test_token'],
  ])('registers the client upload handler in the import map %s', async (_name, token) => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', token)
    vi.stubEnv('NODE_ENV', 'test')
    const resolved = await (await loadConfig()).default
    expect(
      resolved.admin.dependencies?.[
        '@payloadcms/storage-vercel-blob/client#VercelBlobClientUploadHandler'
      ],
    ).toBeDefined()
  })
})
