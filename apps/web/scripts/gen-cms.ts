import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { ManifestSchema, type Field, type Manifest, type Section } from '../schemas/manifest'

const MANIFEST_FILE = path.join(process.cwd(), 'site.manifest.json')
const CONFIG_FILE = path.join(process.cwd(), 'payload.config.ts')
const SNAPSHOT_FILE = path.join(process.cwd(), '.payload-field-locales.json')

export function loadManifest(file = MANIFEST_FILE): Manifest {
  return ManifestSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
}

/** `Section.field` -> `translatable`, used to catch a silent localized flip. */
export function buildSnapshot(manifest: Manifest): Record<string, boolean> {
  const snapshot: Record<string, boolean> = {}
  for (const section of manifest.sections) {
    for (const field of section.fields) {
      snapshot[`${section.name}.${field.name}`] = field.translatable
    }
  }
  return snapshot
}

/**
 * Throws when a field that existed in the previous snapshot has changed its
 * `translatable` value. Payload's `localized` cannot be toggled on an
 * existing field without a written migration (see ADR-0005).
 */
export function checkTranslatableFlips(
  previous: Record<string, boolean>,
  next: Record<string, boolean>,
): void {
  const flipped = Object.keys(next).filter((key) => key in previous && previous[key] !== next[key])
  if (flipped.length > 0) {
    throw new Error(
      `gen:cms refuses to change 'translatable' on existing field(s): ${flipped.join(', ')}. ` +
        `Toggling localization on an existing field can lose stored content ` +
        `(see ADR-0005) — write a manual migration instead.`,
    )
  }
}

const indent = (text: string, depth: number) =>
  text
    .split('\n')
    .map((line) => (line.length > 0 ? '  '.repeat(depth) + line : line))
    .join('\n')

function fieldSource(field: Field): string {
  const lines: string[] = [`name: '${field.name}',`]

  switch (field.type) {
    case 'text':
      lines.push(`type: 'text',`)
      break
    case 'number':
      lines.push(`type: 'number',`)
      break
    case 'url':
      lines.push(`type: 'text',`)
      break
    case 'image':
      lines.push(`type: 'upload',`, `relationTo: 'media',`)
      break
  }

  if (field.type === 'url') {
    lines.push(
      `validate: (value: unknown) => {`,
      `  if (!value) return true`,
      `  return (`,
      `    /^(\\/|#|https?:\\/\\/)/.test(String(value)) ||`,
      `    'Must be a relative path, an anchor, or an absolute URL'`,
      `  )`,
      `},`,
    )
  }

  if (field.translatable) {
    lines.push(`localized: true,`)
  }

  return `{\n${indent(lines.join('\n'), 1)}\n},`
}

// Collections need a stable key for `bun run seed` to upsert by, since the
// Phase 1 content arrays carry no id of their own — position is all they have.
const SEED_INDEX_FIELD = `{
  name: '_seedIndex',
  type: 'number',
  unique: true,
  admin: {
    hidden: true,
  },
},`

function sectionSource(section: Section): string {
  const generatedFields = section.kind === 'collection' ? SEED_INDEX_FIELD + '\n' : ''
  const fields = generatedFields + section.fields.map(fieldSource).join('\n')
  const body = `slug: '${section.name}',\nfields: [\n${indent(fields, 1)}\n],`
  return `{\n${indent(body, 1)}\n}`
}

/** Byte-identical for the same manifest input — idempotent by construction. */
export function generateConfigSource(manifest: Manifest): string {
  const globals = manifest.sections.filter((s) => s.kind === 'global')
  const collections = manifest.sections.filter((s) => s.kind === 'collection')
  const locales = manifest.locales.map((l) => `'${l}'`).join(', ')

  return `// GENERATED FILE — do not edit by hand.
// Source of truth: site.manifest.json. Regenerate with \`bun run gen:cms\`.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig, type CollectionConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  fields: [],
}

const Media: CollectionConfig = {
  slug: 'media',
  upload: true,
  // Public marketing site: every section renders an <img> from this
  // collection, so reads must not require auth (Payload's default access
  // blocks unauthenticated requests, which 403'd every image on the page).
  access: {
    read: () => true,
  },
  fields: [
    {
      // The seed's identity for an asset, and the reason it is not the
      // filename: /icons/logo.png and /img/logo.png share a basename, so a
      // filename lookup would hand the second field the first file's image and
      // nothing would report it. Unique, so the database refuses a collision
      // rather than resolving it silently.
      name: 'sourcePath',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'public/-relative path this asset was seeded from' },
    },
  ],
}

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  editor: lexicalEditor(),
  // A bundled sqlite file works locally and cannot work on a serverless host:
  // the deployment filesystem is read-only apart from a per-invocation /tmp, so
  // an editor's save either fails or disappears with the invocation. A hosted
  // libSQL database (Turso and similar) is the same adapter with a remote URL,
  // which is why DATABASE_AUTH_TOKEN is plumbed through — without it a remote
  // url cannot authenticate and the default file: path is the only thing that
  // works. Deploying with the default is the failure mode to avoid.
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./payload.db',
      ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
    },
  }),
  secret: (() => {
    if (process.env.PAYLOAD_SECRET) return process.env.PAYLOAD_SECRET
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PAYLOAD_SECRET must be set in production')
    }
    return 'dev-secret-change-me'
  })(),
  localization: {
    locales: [${locales}],
    defaultLocale: '${manifest.locales[0]}',
  },
  collections: [
    Users,
    Media,
${indent(collections.map(sectionSource).join(',\n'), 2)}${collections.length > 0 ? ',' : ''}
  ],
  globals: [
${indent(globals.map(sectionSource).join(',\n'), 2)}${globals.length > 0 ? ',' : ''}
  ],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
`
}

function main() {
  const manifest = loadManifest()
  const nextSnapshot = buildSnapshot(manifest)

  if (existsSync(SNAPSHOT_FILE)) {
    const previousSnapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'))
    checkTranslatableFlips(previousSnapshot, nextSnapshot)
  }

  writeFileSync(CONFIG_FILE, generateConfigSource(manifest))
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(nextSnapshot, null, 2) + '\n')
  console.log(`Wrote ${path.relative(process.cwd(), CONFIG_FILE)}`)
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  main()
}
