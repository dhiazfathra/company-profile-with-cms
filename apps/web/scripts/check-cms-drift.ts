import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { generateConfigSource, loadManifest } from './gen-cms'

const CONFIG_FILE = path.join(process.cwd(), 'payload.config.ts')

function main() {
  const manifest = loadManifest()
  const expected = generateConfigSource(manifest)

  if (!existsSync(CONFIG_FILE)) {
    console.error(
      `${path.relative(process.cwd(), CONFIG_FILE)} is missing — run \`bun run gen:cms\`.`,
    )
    process.exit(1)
  }

  const actual = readFileSync(CONFIG_FILE, 'utf8')

  if (actual !== expected) {
    console.error(
      `payload.config.ts is out of sync with site.manifest.json. Run \`bun run gen:cms\` and commit the result.`,
    )
    process.exit(1)
  }

  console.log('payload.config.ts matches site.manifest.json.')
}

main()
