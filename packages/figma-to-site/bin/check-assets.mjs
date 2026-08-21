#!/usr/bin/env node
/**
 * Fail if any committed image contains Figma's interface.
 *
 * Usage: figma-check-assets <dir> [dir ...]
 *
 * The same detector runs inside the capture path (`assertNoViewerChrome`) and as
 * a project test. This CLI exists for the third case: checking a tree you did not
 * capture — a handover, a pull request, an assets folder someone dropped in.
 */
import { scanAssets } from '../src/scan-assets.mjs'

const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!dirs.length) {
  console.error('usage: figma-check-assets <dir> [dir ...]')
  process.exit(1)
}

let scan
try {
  scan = await scanAssets(dirs)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

for (const dir of scan.empty) console.error(`${dir}: no images found`)
for (const line of scan.contaminated) console.error(`FAIL  ${line}`)

console.log(`scanned ${scan.scanned.length} image(s) in ${dirs.length} director(ies)`)

if (scan.contaminated.length) {
  console.error(
    `\n${scan.contaminated.length} image(s) contain selection outlines, dimension badges or ` +
      `panels. A dimension badge means the declared node size for that target is wrong — ` +
      `read the size off the badge and re-capture.`,
  )
  process.exit(1)
}
// An empty directory is a failure too: a scan with nothing to scan reads as clean
// and is the easiest way for this guardrail to quietly become a no-op.
if (scan.empty.length) process.exit(1)
