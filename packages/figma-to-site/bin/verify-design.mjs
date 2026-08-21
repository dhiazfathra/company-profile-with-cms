#!/usr/bin/env node
/**
 * Check a rendered site against its Figma design references, from the CLI.
 *
 * The comparison itself lives in `src/design-check.mjs` — see that file for what
 * is compared and why. This wrapper is for iterating locally: it drives its own
 * browser against an already-running dev server and prints one line per section.
 * The same comparison runs in CI through a project's Playwright spec, so a local
 * pass and a CI pass mean the same thing.
 *
 * Usage: figma-verify-design [Section ...]
 *   BASE_URL         server to check (default http://localhost:3000)
 *   VIEWPORT_WIDTH   browser width (default 1500; a page may cap itself narrower)
 *   REFS_DIR         references and refs.json (default design/refs)
 *   VERIFY_OUT       where renders and report.json go (default design/verify)
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import {
  DEFAULT_REFS_DIR,
  awaitImages,
  checkSection,
  loadManifest,
  screenshotSection,
} from '../src/design-check.mjs'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const REFS_DIR = process.env.REFS_DIR ?? DEFAULT_REFS_DIR
const OUT = process.env.VERIFY_OUT ?? 'design/verify'

let manifest
try {
  manifest = loadManifest(REFS_DIR)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
const known = Object.keys(manifest.sections)
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const unknown = args.filter((s) => !known.includes(s))
if (unknown.length) {
  console.error(`Not in ${REFS_DIR}/refs.json: ${unknown.join(', ')}`)
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
  const result = await checkSection(section, spec, renderPath, REFS_DIR)
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
