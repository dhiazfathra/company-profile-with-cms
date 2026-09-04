import { describe, expect, it } from 'vitest'
import config from '@/payload.config'

/**
 * The Media collection's mimeTypes allowlist, asserted by value.
 *
 * payload.config.ts is generated from site.manifest.json, so the allowlist
 * lives in scripts/gen-cms.ts and a regeneration is exactly how it would go
 * missing — silently, with the generator's own tests still green because they
 * check field shape, not upload policy. Without the allowlist an editor account
 * can upload text/html and have /api/media/file/<name> serve it from this
 * origin. See ADR-0021.
 */
describe('media upload allowlist', () => {
  it('accepts only the image types the seed uploads', async () => {
    const resolved = await config
    const media = resolved.collections.find((c) => c.slug === 'media')
    expect(media).toBeDefined()
    const mimeTypes = media!.upload && (media!.upload as { mimeTypes?: string[] }).mimeTypes
    expect(mimeTypes).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ])
  })

  it('rejects the executable types, not just "everything not on the list"', async () => {
    const resolved = await config
    const media = resolved.collections.find((c) => c.slug === 'media')
    const mimeTypes = (media!.upload as { mimeTypes?: string[] }).mimeTypes ?? []
    // Named individually rather than asserted as an absence: these are the ones
    // that turn an upload into same-origin script execution, and a test that
    // only says "the list is short" would pass with any of them on it.
    for (const dangerous of [
      'text/html',
      'application/javascript',
      'text/javascript',
      'application/xhtml+xml',
      'image/svg',
      '*',
    ]) {
      expect(mimeTypes).not.toContain(dangerous)
    }
  })
})
