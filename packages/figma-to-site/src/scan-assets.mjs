/**
 * Scan committed images for Figma's interface.
 *
 * `assertNoViewerChrome` guards the capture path, but the capture script is not
 * the only way a file lands in `public/`: assets get hand-replaced, copied from a
 * chat, or produced by a script that predates the check. So the same detector runs
 * over what is *committed*, as a test, in whatever project consumes this package.
 *
 * A found region is usually a symptom rather than the disease. Figma prints the
 * node's real size in its dimension badge, and the badge's presence means the crop
 * reached past the node it was aiming at — which means the size declared for that
 * node in the capture config is wrong. Read the number off the badge.
 */
import { readdir } from 'node:fs/promises'
import { findViewerChrome } from './figma-crop.mjs'

const IMAGE = /\.(png|jpe?g)$/i

/**
 * Check every image in `dirs`.
 *
 * Returns `{ scanned, contaminated }`. `contaminated` entries carry the file and
 * its offending regions, formatted for a test assertion. An empty directory is
 * reported in `empty` rather than passing silently: a scan that found no files to
 * scan is not a clean scan, and that distinction is the difference between a
 * guardrail and a no-op.
 */
export async function scanAssets(dirs, options) {
  const scanned = []
  const empty = []
  const contaminated = []

  for (const dir of dirs) {
    const files = (await readdir(dir)).filter((f) => IMAGE.test(f)).sort()
    if (!files.length) {
      empty.push(dir)
      continue
    }
    for (const file of files) {
      const path = `${dir}/${file}`
      scanned.push(path)
      const blobs = await findViewerChrome(path, options)
      if (!blobs.length) continue
      const worst = blobs
        .slice(0, 3)
        .map((b) => `${b.w}x${b.h}@${b.x0},${b.y0}`)
        .join('; ')
      contaminated.push(`${path}: ${blobs.length} region(s) — ${worst}`)
    }
  }

  return { scanned, empty, contaminated }
}
