import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ManifestSchema } from '../schemas/manifest'

const file = path.join(process.cwd(), 'site.manifest.json')
const result = ManifestSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))

if (!result.success) {
  console.error('site.manifest.json is invalid:\n')
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
  process.exit(1)
}

console.log(`site.manifest.json valid — ${result.data.sections.length} sections, locales: ${result.data.locales.join(', ')}`)
