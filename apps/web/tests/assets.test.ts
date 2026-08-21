import { describe, expect, it } from 'vitest'
import { scanAssets } from 'figma-to-site'

/**
 * Every image in this repo was cropped out of a screenshot of the Figma web
 * viewer, so every image could contain Figma's interface rather than the design.
 * Two did. Two were caught by a human looking at the page; the second — a
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
 * `packages/figma-to-site/src/capture.mjs` (via `design/figma.targets.json`) is
 * wrong. Read the number off the badge.
 */
const DIRS = ['public/img', 'public/icons', 'design/refs']

describe('captured assets', () => {
  it('every asset directory scans clean', async () => {
    const { empty, contaminated } = await scanAssets(DIRS)
    expect(empty, 'an empty directory has nothing to scan and is not a clean scan').toEqual([])
    expect(
      contaminated,
      'selection outlines, dimension badges and panels are not design',
    ).toEqual([])
  })
})
