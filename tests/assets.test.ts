import { readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { findViewerChrome } from '@/scripts/figma-crop.mjs'

/**
 * Every image in this repo was cropped out of a screenshot of the Figma web
 * viewer, so every image could contain Figma's interface rather than the design.
 * Three did. Two were caught by a human looking at the page; the third — a
 * 237x34 dimension badge along the bottom edge of the showcase image — survived
 * a passing design-fidelity check, because a badge that small barely moves a
 * 48-cell block average.
 *
 * So the badge gets its own check, and it runs over what is committed rather
 * than only at capture time: an asset can be replaced by hand, and the capture
 * script is not the only way a file lands in `public/`.
 *
 * A found badge is usually a symptom rather than the disease. Figma prints the
 * node's real size in it, and its presence means the crop reached past the node
 * it was aiming at — which means the size declared for that node in
 * `scripts/capture-figma.mjs` is wrong. Read the number off the badge.
 */
const DIRS = ['public/img', 'public/icons', 'design/refs']

describe('captured assets', () => {
  for (const dir of DIRS) {
    it(`${dir} contains no Figma interface`, async () => {
      const files = (await readdir(dir)).filter((f) => /\.(png|jpe?g)$/i.test(f))
      expect(files.length, `${dir} should contain images`).toBeGreaterThan(0)

      const contaminated: string[] = []
      for (const file of files) {
        const blobs = await findViewerChrome(`${dir}/${file}`)
        if (blobs.length) {
          const worst = blobs
            .slice(0, 3)
            .map((b: { w: number; h: number; x0: number; y0: number }) => `${b.w}x${b.h}@${b.x0},${b.y0}`)
            .join('; ')
          contaminated.push(`${dir}/${file}: ${blobs.length} region(s) — ${worst}`)
        }
      }
      expect(contaminated, 'selection outlines, dimension badges and panels are not design').toEqual(
        [],
      )
    })
  }
})
