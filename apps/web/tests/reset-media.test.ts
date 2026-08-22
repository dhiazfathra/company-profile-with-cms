import { describe, expect, it } from 'vitest'
import { getPayload } from '../lib/payload'
import { loadManifest } from '../scripts/gen-cms'
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

      for (const doc of before.docs) {
        await payload.delete({ collection: 'media', id: doc.id })
      }
      expect((await payload.find({ collection: 'media', limit: 0 })).totalDocs).toBe(0)

      await seedAll(payload, manifest)

      const after = await payload.find({ collection: 'media', limit: 0 })
      expect(after.totalDocs).toBe(before.totalDocs)

      const sourcePaths = after.docs.map((d) => d.sourcePath)
      expect(new Set(sourcePaths).size).toBe(sourcePaths.length)
    },
  )
})
