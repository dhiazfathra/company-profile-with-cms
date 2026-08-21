import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ManifestSchema } from '../schemas/manifest'

const file = path.join(process.cwd(), 'site.manifest.json')

let raw: string
try {
  raw = readFileSync(file, 'utf8')
} catch {
  console.error(`Cannot read ${file} — does it exist?`)
  process.exit(1)
}

let json: unknown
try {
  json = JSON.parse(raw)
} catch (err) {
  console.error(`${file} is not valid JSON: ${(err as Error).message}`)
  process.exit(1)
}

const result = ManifestSchema.safeParse(json)

if (!result.success) {
  console.error('site.manifest.json is invalid:\n')
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
  process.exit(1)
}

console.log(`site.manifest.json valid — ${result.data.sections.length} sections, locales: ${result.data.locales.join(', ')}`)
