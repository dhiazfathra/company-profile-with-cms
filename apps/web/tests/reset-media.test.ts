import { describe, expect, it } from 'vitest'
import { getPayload } from '../lib/payload'
import { loadManifest } from '../scripts/gen-cms'
import { assertUsableBlobToken, resetMedia } from '../scripts/reset-media'
import { seedAll } from '../scripts/seed'

/**
 * reset-media.ts's own logic is three lines: find, delete each, done. What's
 * worth proving is the reason it exists — that clearing the collection first
 * and reseeding leaves exactly one row per asset, with no leftover duplicate
 * from whatever produced the ones this script exists to clean up (ADR-0014,
 * docs/parity-gaps.md).
 */
describe('reset-media', () => {
  // Deletes and re-uploads all 18 seeded images, each real file I/O; the
  // default 5s budget is tight once other test files' Payload instances are
  // running concurrently.
  it(
    'reseeding after a full delete leaves exactly one row per asset, no duplicates',
    { timeout: 20_000 },
    async () => {
      const payload = await getPayload()
      const manifest = loadManifest()

      const before = await payload.find({ collection: 'media', limit: 0 })
      expect(before.totalDocs).toBeGreaterThan(0)

      // resetMedia, not a reimplementation of it: the value of this test is that
      // it breaks when the command that runs against production breaks.
      expect(await resetMedia(payload)).toBe(before.totalDocs)

      await seedAll(payload, manifest)

      const after = await payload.find({ collection: 'media', limit: 0 })
      expect(after.totalDocs).toBe(before.totalDocs)

      const sourcePaths = after.docs.map((d) => d.sourcePath)
      expect(new Set(sourcePaths).size).toBe(sourcePaths.length)
    },
  )
})

/**
 * The guard is the only thing standing between a mistyped invocation and an
 * empty production media collection, so it is tested in the failing direction
 * too. `[SENSITIVE]` is the specific value `vercel env pull` writes for a
 * variable flagged Sensitive, and the documented command pipes that file
 * straight into this script.
 */
describe('reset-media refuses to delete without a usable token', () => {
  it('accepts a real blob token', () => {
    expect(() => assertUsableBlobToken('vercel_blob_rw_store123_abcdef')).not.toThrow()
  })

  it('refuses when the token is absent', () => {
    expect(() => assertUsableBlobToken(undefined)).toThrow(/is not set/)
  })

  it('refuses the redacted value vercel env pull writes for a Sensitive variable', () => {
    expect(() => assertUsableBlobToken('[SENSITIVE]')).toThrow(/redacted/)
  })

  it('refuses a value of the wrong shape rather than deleting against it', () => {
    expect(() => assertUsableBlobToken('changeme')).toThrow(/not a blob token/)
  })
})
