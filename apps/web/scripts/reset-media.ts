/**
 * One-off cleanup for a database seeded before blob storage existed (ADR-0014).
 *
 * `uploadImage` in `seed.ts` finds an existing row by `sourcePath` and reuses
 * it rather than re-uploading — right for an ordinary re-seed, wrong here: a
 * row created under the old disk-storage config has no real file behind it on
 * a serverless deployment, and reusing it means `bun run seed` silently skips
 * the very rows that need to be recreated against blob storage. Deleting the
 * `media` collection first forces `seedAll` to create every row fresh, through
 * whichever adapter `payload.config.ts` currently resolves to.
 *
 * Also the fix for the duplicate rows recorded in ADR-0014 and
 * docs/parity-gaps.md as deferred and undiagnosed (`header-30.png`,
 * `logo-190.png`, ...): whatever produced them, clearing the collection and
 * reseeding leaves exactly one row per `sourcePath`, because that is what a
 * clean seed run always produces.
 *
 * Deliberately not run automatically by `seed` or by any CI step: it deletes
 * data, and the one case it exists for — a database that predates blob
 * storage — is a one-time migration, not a step that belongs in a pipeline
 * that runs on every push. Run by hand, once, against production:
 *
 *   vercel env pull --environment production apps/web/.env.production.local
 *   bun run --env-file=.env.production.local --cwd apps/web reset-media
 *   bun run --env-file=.env.production.local --cwd apps/web seed
 *   rm apps/web/.env.production.local
 *
 * Confirm with `bun run parity-report --skip-local --prod <url>` afterwards.
 */
import { getPayload } from '../lib/payload'

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.NODE_ENV === 'production') {
    // The same guard payload.config.ts already enforces, checked again here
    // because this script's whole point is pointless without it: deleting
    // every media row and then reseeding against local disk storage would
    // recreate the exact defect ADR-0014 exists to close.
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set. Deleting media now would just reseed ' +
        'into the same broken disk-storage path this script exists to fix.',
    )
  }

  const payload = await getPayload()
  const existing = await payload.find({ collection: 'media', limit: 0 })
  console.log(`Deleting ${existing.totalDocs} media row(s)...`)
  for (const doc of existing.docs) {
    await payload.delete({ collection: 'media', id: doc.id })
  }
  console.log('Done. Run `bun run seed` next to recreate them against blob storage.')
  process.exit(0)
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  main()
}
