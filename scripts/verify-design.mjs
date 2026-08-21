/**
 * Check the rendered site against the Figma design references, from the CLI.
 *
 * The comparison itself lives in `scripts/design-check.mjs`, shared with
 * `e2e/design-fidelity.spec.ts` — see that file for what is compared and why.
 * This wrapper is for iterating locally: it drives its own browser against an
 * already-running dev server and prints one line per section.
 *
 * Usage: node scripts/verify-design.mjs [Section ...]
 *   BASE_URL         server to check (default http://localhost:3000)
 *   VIEWPORT_WIDTH   browser width (default 1500; the page caps itself at 1200)
 *   VERIFY_OUT       where renders and report.json go (default design/verify)
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { awaitImages, checkSection, loadManifest, screenshotSection } from './design-check.mjs'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const OUT = process.env.VERIFY_OUT ?? 'design/verify'

const manifest = loadManifest()
const known = Object.keys(manifest.sections)
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const unknown = args.filter((s) => !known.includes(s))
if (unknown.length) {
  console.error(`Not in design/refs/refs.json: ${unknown.join(', ')}`)
  console.error(`Known: ${known.join(', ')}`)
  process.exit(1)
}
const targets = args.length ? args : known

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: Number(process.env.VIEWPORT_WIDTH ?? 1500), height: 1200 },
  deviceScaleFactor: 2,
})
const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' })
if (!response?.ok()) {
  console.error(`${BASE_URL} returned ${response?.status() ?? 'no response'}`)
  await browser.close()
  process.exit(1)
}
await awaitImages(page)

const results = []
for (const section of targets) {
  const spec = manifest.sections[section]
  const renderPath = `${OUT}/${section}.render.png`
  try {
    await screenshotSection(page, section, renderPath)
  } catch (error) {
    results.push({ section, failures: [error.message] })
    continue
  }
  const result = await checkSection(section, spec, renderPath)
  if (!spec.blockCheck) {
    // Recorded, not silent: an untrusted reference is a gap in coverage, and the
    // run should say so rather than quietly checking one axis.
    console.log(`note  ${section}: content check disabled — ${spec.blockToleranceReason}`)
  }
  results.push(result)
}

await browser.close()

const width = Math.max(...results.map((r) => r.section.length))
for (const r of results) {
  const name = r.section.padEnd(width)
  if (r.failures.length) {
    console.log(`FAIL  ${name}  ${r.failures.join('; ')}`)
  } else {
    const block = r.blockChecked ? `block ${r.block.toFixed(1)}` : 'block n/a'
    console.log(`pass  ${name}  aspect ${(r.aspectDelta * 100).toFixed(1)}%  ${block}`)
  }
}

await writeFile(`${OUT}/report.json`, `${JSON.stringify(results, null, 2)}\n`)
console.log(`\nrenders and report in ${OUT}/`)

const failed = results.filter((r) => r.failures.length)
if (failed.length) {
  console.error(`\n${failed.length} of ${results.length} sections do not match the design.`)
  process.exit(1)
}
