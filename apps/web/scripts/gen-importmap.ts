// Regenerates app/(payload)/admin/importMap.js from payload.config.ts.
//
// Payload resolves every admin component through this file at runtime, and
// nothing generates it during `next build` or `next dev` — it is written by
// `payload generate:importmap` and committed. A map that does not list a
// component the config asks for makes /admin render blank with
// `getFromImportMap: PayloadComponent not found`, with no build failure.
//
// The upstream CLI cannot load this config (its tsx require-hook chokes on the
// top-level await inside @payloadcms/richtext-lexical: ERR_REQUIRE_ASYNC_MODULE),
// so this calls the same generator directly under bun, which loads ESM natively.
// Run with `--check` to fail instead of writing — that is the CI drift gate.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { format, resolveConfig } from 'prettier'
import config from '../payload.config'

const IMPORT_MAP = path.join(process.cwd(), 'app', '(payload)', 'admin', 'importMap.js')

const payloadDist = path.dirname(fileURLToPath(import.meta.resolve('payload')))
const { generateImportMap } = (await import(
  pathToFileURL(path.join(payloadDist, 'bin', 'generateImportMap', 'index.js')).href
)) as { generateImportMap: (config: unknown, options: unknown) => Promise<void> }

const check = process.argv.includes('--check')
const before = readFileSync(IMPORT_MAP, 'utf8')

await generateImportMap(await config, { force: true, log: !check })

// Payload's writer emits one `import` line per component, which is over the
// repository's 100-column limit as soon as a component's path and its hashed
// identifier are on it. The commit gate does not read `.prettierignore`, so a
// generated file it can never format blocks every commit in the repository
// until someone bypasses the gate — the failure mode ADR-0016 and step 10 of
// packages/site-to-cms/SKILL.md both exist to avoid. Formatting here makes the
// generator's output already-formatted, so `--check` compares like with like.
const source = readFileSync(IMPORT_MAP, 'utf8')
writeFileSync(
  IMPORT_MAP,
  await format(source, { ...(await resolveConfig(IMPORT_MAP)), filepath: IMPORT_MAP }),
)

if (check && readFileSync(IMPORT_MAP, 'utf8') !== before) {
  // Leave the tree as the run found it, so a later `git diff` in the same job
  // reports what the author committed rather than what this check rewrote.
  writeFileSync(IMPORT_MAP, before)
  console.error(
    'app/(payload)/admin/importMap.js is out of sync with payload.config.ts. ' +
      'Run `bun run gen:importmap` and commit the result.',
  )
  process.exit(1)
}

console.log(check ? 'importMap.js matches payload.config.ts.' : 'Wrote importMap.js')
