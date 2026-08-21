import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { BasePayload } from 'payload'
import { getPayload } from '../lib/payload'
import { loadManifest } from './gen-cms'
import type { Manifest, Section } from '../schemas/manifest'

// ponytail: image fields are seeded as null — uploading Figma-exported
// screenshots into Payload's media collection is a separate concern from
// text/url seeding. Wire it up when an editor actually needs to replace an
// image from the admin panel.
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

async function seedGlobal(payload: BasePayload, section: Section, locales: string[]) {
  const raw = await readContent<Record<string, unknown>>('globals', section.name)

  for (const locale of locales) {
    const data: Record<string, unknown> = {}
    for (const field of section.fields) {
      if (field.type === 'image') continue
      const value = localizedValue(raw, field.name, field.translatable, locale)
      if (value !== undefined) data[field.name] = value
    }
    await payload.updateGlobal({ slug: section.name, locale, data })
  }
}

async function seedCollection(payload: BasePayload, section: Section, locales: string[]) {
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
        if (field.type === 'image') continue
        const value = localizedValue(raw, field.name, field.translatable, locale)
        if (value !== undefined) data[field.name] = value
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
  for (const section of manifest.sections) {
    if (section.kind === 'global') {
      await seedGlobal(payload, section, manifest.locales)
    } else {
      await seedCollection(payload, section, manifest.locales)
    }
  }
}

async function main() {
  const manifest = loadManifest()
  const payload = await getPayload()
  await seedAll(payload, manifest)
  for (const section of manifest.sections) {
    console.log(`Seeded ${section.name}`)
  }
  process.exit(0)
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  main()
}
