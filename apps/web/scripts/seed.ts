import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { BasePayload } from 'payload'
import { getPayload } from '../lib/payload'
import { loadManifest } from './gen-cms'
import type { Manifest, Section } from '../schemas/manifest'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

/**
 * Media ids already resolved during *this* seed run, so an asset reused across
 * locales or sections uploads once.
 *
 * Built per run, not per module: `seedAll` is called again against a rebuilt
 * database (every test file does exactly this), and a cache outliving the
 * database it describes hands out ids for rows that no longer exist.
 */
type MediaCache = Map<string, string | number>

/**
 * Uploads a `public/`-relative image path (the flat-JSON content format's
 * image value, e.g. "/img/showcase.png") into Payload's media collection and
 * returns its id, reusing the existing doc for that path so re-running seed
 * doesn't pile up duplicates.
 *
 * Identity is the full public path, held in the media doc's `sourcePath`.
 * Basenames are not unique — `/icons/logo.png` and `/img/logo.png` collide —
 * and resolving that collision silently would point a section at the wrong
 * image with nothing failing.
 */
async function uploadImage(
  payload: BasePayload,
  cache: MediaCache,
  publicPath: string,
): Promise<string | number> {
  const cached = cache.get(publicPath)
  if (cached !== undefined) return cached

  const existing = await payload.find({
    collection: 'media',
    where: { sourcePath: { equals: publicPath } },
    limit: 1,
  })
  if (existing.docs[0]?.id !== undefined) {
    cache.set(publicPath, existing.docs[0].id)
    return existing.docs[0].id
  }

  const filename = path.basename(publicPath)
  const absolutePath = path.join(process.cwd(), 'public', publicPath)
  const data = await readFile(absolutePath)
  const mimeType = MIME_BY_EXT[path.extname(filename).toLowerCase()] ?? 'application/octet-stream'
  const created = await payload.create({
    collection: 'media',
    data: { sourcePath: publicPath },
    file: { data, mimetype: mimeType, name: filename, size: data.length },
  })
  cache.set(publicPath, created.id)
  return created.id
}

function localizedValue(
  raw: Record<string, unknown>,
  fieldName: string,
  translatable: boolean,
  locale: string,
): unknown {
  if (translatable) return raw[`${fieldName}_${locale}`]
  return raw[fieldName]
}

async function readContent<T>(dir: 'globals' | 'collections', name: string): Promise<T> {
  const file = path.join(process.cwd(), 'content', dir, `${name}.json`)
  return JSON.parse(await readFile(file, 'utf8')) as T
}

async function seedGlobal(
  payload: BasePayload,
  cache: MediaCache,
  section: Section,
  locales: string[],
) {
  const raw = await readContent<Record<string, unknown>>('globals', section.name)

  for (const locale of locales) {
    const data: Record<string, unknown> = {}
    for (const field of section.fields) {
      const value = localizedValue(raw, field.name, field.translatable, locale)
      if (value === undefined) continue
      data[field.name] =
        field.type === 'image' ? await uploadImage(payload, cache, value as string) : value
    }
    await payload.updateGlobal({ slug: section.name, locale, data })
  }
}

async function seedCollection(
  payload: BasePayload,
  cache: MediaCache,
  section: Section,
  locales: string[],
) {
  const items = await readContent<Record<string, unknown>[]>('collections', section.name)
  const collection = section.name as Parameters<typeof payload.find>[0]['collection']

  for (const [index, raw] of items.entries()) {
    const existing = await payload.find({
      collection,
      where: { _seedIndex: { equals: index } },
      limit: 1,
    })
    let id: string | number | undefined = existing.docs[0]?.id

    for (const locale of locales) {
      const data: Record<string, unknown> = { _seedIndex: index }
      for (const field of section.fields) {
        const value = localizedValue(raw, field.name, field.translatable, locale)
        if (value === undefined) continue
        data[field.name] =
          field.type === 'image' ? await uploadImage(payload, cache, value as string) : value
      }

      if (id === undefined) {
        const created = await payload.create({ collection, locale, data })
        id = created.id
      } else {
        await payload.update({ collection, id, locale, data })
      }
    }
  }
}

export async function seedAll(payload: BasePayload, manifest: Manifest): Promise<void> {
  const cache: MediaCache = new Map()
  for (const section of manifest.sections) {
    if (section.kind === 'global') {
      await seedGlobal(payload, cache, section, manifest.locales)
    } else {
      await seedCollection(payload, cache, section, manifest.locales)
    }
  }
}

/**
 * Creates the account `e2e/cms-round-trip.spec.ts` logs in as, so that test can
 * change a value through the API the way an editor would.
 *
 * Opt-in through both env vars, and it only ever runs against a database the
 * caller seeds — never a default, never a fallback password. Reads of globals
 * require auth, so without this the round-trip test cannot make the edit whose
 * arrival on the page is the whole point of Phase 2.
 */
export async function seedE2eUser(payload: BasePayload): Promise<'created' | 'reset' | 'skipped'> {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  if (!email || !password) return 'skipped'

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })
  const id = existing.docs[0]?.id
  if (id === undefined) {
    await payload.create({ collection: 'users', data: { email, password } })
    return 'created'
  }
  // Same email, unknown password (a database carried over from an earlier run).
  // Reset rather than assume, or the login fails for a reason no message names.
  await payload.update({ collection: 'users', id, data: { password } })
  return 'reset'
}

async function main() {
  const manifest = loadManifest()
  const payload = await getPayload()
  await seedAll(payload, manifest)
  for (const section of manifest.sections) {
    console.log(`Seeded ${section.name}`)
  }
  const user = await seedE2eUser(payload)
  if (user !== 'skipped') console.log(`e2e user ${user}: ${process.env.E2E_USER_EMAIL}`)
  process.exit(0)
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  main()
}
