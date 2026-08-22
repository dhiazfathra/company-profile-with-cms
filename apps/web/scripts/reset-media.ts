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
 * that runs on every push. Run by hand, once, against production, with the
 * credentials exported explicitly — `vercel env pull` returns `[SENSITIVE]`
 * for all three, because they are flagged Sensitive on the project:
 *
 *   export DATABASE_URI='libsql://...' DATABASE_AUTH_TOKEN='...' \
 *          BLOB_READ_WRITE_TOKEN='vercel_blob_rw_...'
 *   bun run --cwd apps/web reset-media
 *   bun run --cwd apps/web seed
 *
 * Confirm with `bun run parity-report --skip-local --prod <url>` afterwards.
 * Full procedure and rationale: docs/parity-gaps.md.
 */
import type { Payload } from 'payload'
import { getPayload } from '../lib/payload'

/**
 * Refuses to delete anything unless a usable blob token is present.
 *
 * Not gated on `NODE_ENV`, and that is the point. The documented invocation
 * above passes production credentials through `--env-file`, which sets
 * `DATABASE_URI` and never sets `NODE_ENV` — so a guard reading `NODE_ENV`
 * would sit silently open on exactly the run that can do damage.
 *
 * The shape check is not decoration either. `DATABASE_URI` and
 * `BLOB_READ_WRITE_TOKEN` are flagged Sensitive on the Vercel project, so
 * `vercel env pull` writes the literal string `[SENSITIVE]` in place of each
 * value (docs/parity-gaps.md). A presence-only check passes that string, every
 * row gets deleted, and the reseed then dies on
 * `Invalid token format for Vercel Blob adapter` — leaving production with no
 * media rows at all, which is worse than the broken images this script exists
 * to fix. Deleting data is the last thing this script should be willing to do
 * on a value it has not looked at.
 */
export function assertUsableBlobToken(token = process.env.BLOB_READ_WRITE_TOKEN) {
  if (!token) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set. Deleting media now would reseed into the ' +
        'same broken disk-storage path this script exists to fix.',
    )
  }
  if (!token.startsWith('vercel_blob_rw_')) {
    throw new Error(
      `BLOB_READ_WRITE_TOKEN is not a blob token (got "${token.slice(0, 16)}..."). ` +
        'A value of "[SENSITIVE]" means `vercel env pull` redacted it: the variable is ' +
        'flagged Sensitive on the project. Supply the real token, or run this from a ' +
        'shell that has it — do not delete media against a redacted value.',
    )
  }
}

/**
 * Deletes every row in the media collection. Exported so the CLI below and
 * `tests/reset-media.test.ts` exercise the same code — a test that reimplements
 * the loop proves the loop it wrote, not the one that runs against production.
 */
export async function resetMedia(payload: Payload) {
  // Names the database before deleting from it. `DATABASE_URI` unset is a valid
  // configuration meaning "local payload.db", so credentials written to the
  // wrong .env produce a successful run against the wrong database rather than
  // an error — the one failure mode this script cannot detect for you.
  console.log(`Target: ${process.env.DATABASE_URI ?? 'file:./payload.db (DATABASE_URI unset)'}`)
  const existing = await payload.find({ collection: 'media', limit: 0 })
  console.log(`Deleting ${existing.totalDocs} media row(s)...`)
  for (const doc of existing.docs) {
    await payload.delete({ collection: 'media', id: doc.id })
  }
  const left = await payload.find({ collection: 'media', limit: 0 })
  if (left.totalDocs > 0) {
    throw new Error(`${left.totalDocs} media row(s) survived the delete; not safe to reseed.`)
  }
  return existing.totalDocs
}

async function main() {
  assertUsableBlobToken()
  const payload = await getPayload()
  const deleted = await resetMedia(payload)
  console.log(`Done, ${deleted} row(s) deleted. Run \`bun run seed\` next to recreate them.`)
  process.exit(0)
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  main()
}
