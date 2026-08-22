/**
 * CLI wrapper around `cms-discover.ts`, kept separate for one reason: Playwright
 * transpiles the spec's imports to CommonJS, and `import.meta` in a transpiled
 * module is a syntax error. `e2e/cms-fields.spec.ts` imports the case generator
 * from that file, so the file must stay free of `import.meta` — which the
 * entry-point guard needs. Two files, and both consumers work.
 *
 *   bun scripts/cms-discover-cli.ts <output-dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildInventory, casesFor, fieldMatrixMarkdown, renderedSections } from './cms-discover'

const out = process.argv[2]
if (!out) throw new Error('usage: bun scripts/cms-discover-cli.ts <output-dir>')

const config = await (await import('../payload.config')).default
// `import.meta.dir` is Bun's, and `next build` type-checks this directory
// against the DOM/ES lib where it does not exist. The URL form works in both.
const here = path.dirname(fileURLToPath(import.meta.url))
const sections = await renderedSections(path.resolve(here, '../components/sections'))
const inventory = await buildInventory(config, sections)

// The generator's output, written into the inventory so its consumers do not
// have to call it. `scripts/cms-e2e.mjs` and the `cms-to-qa` artefacts are plain
// JavaScript outside this workspace; the spec imports the generator directly and
// does not read these back. The inventory is therefore the one place a case list
// exists for everything downstream, run or not.
for (const page of inventory.pages) {
  for (const field of page.fields) {
    field.cases = casesFor(field, page.page)
  }
}

mkdirSync(out, { recursive: true })
writeFileSync(path.join(out, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n')
for (const page of inventory.pages) {
  const dir = path.join(out, page.page)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'field-matrix.md'), fieldMatrixMarkdown(page))
}

console.log(
  `${inventory.pages.length} pages, ` +
    `${inventory.pages.reduce((n, p) => n + p.fields.length, 0)} fields, ` +
    `${inventory.pages.reduce((n, p) => n + p.fields.reduce((m, f) => m + casesFor(f, p.page).length, 0), 0)} cases`,
)
