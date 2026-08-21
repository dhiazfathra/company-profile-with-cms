import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  awaitImages,
  checkSection,
  loadManifest,
  screenshotSection,
} from 'figma-to-site/design-check'

/**
 * One test per section, comparing the running page against the Figma design.
 *
 * This is the check that was missing when Phase 1 shipped. The assets are
 * captured by cropping screenshots of the Figma web viewer, and the crop finds a
 * node by the size the caller declares for it; where that declared size was
 * wrong the crop silently returned a different region of canvas and shipped it
 * as the asset. Two targets were wrong. Nothing else noticed: the manifest
 * validated, the unit tests passed, the build succeeded, and the rest of this
 * e2e suite went green on a page that rendered a green band inside a green band.
 *
 * The comparison lives in `figma-to-site`'s `design-check` module; `design/refs/refs.json`
 * holds each section's design size and says whether its reference PNG is
 * trustworthy enough to compare content against.
 */
const manifest = loadManifest()
const OUT = 'e2e-results/design'

// The design is drawn at 1200 css px wide and the page caps itself there, so
// this viewport compares like for like. deviceScaleFactor 2 matches the refs.
test.use({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 2 })

test.describe('design fidelity', () => {
  for (const [section, spec] of Object.entries(manifest.sections) as [string, never][]) {
    test(`${section} matches the Figma design`, async ({ page }) => {
      await mkdir(OUT, { recursive: true })
      const response = await page.goto('/', { waitUntil: 'networkidle' })
      expect(response?.status(), 'the page must render').toBe(200)
      await awaitImages(page)

      const renderPath = `${OUT}/${section}.render.png`
      await screenshotSection(page, section, renderPath)
      const result = await checkSection(section, spec, renderPath, manifest.refsDir)

      // Report the whole picture on failure: the render is attached to the
      // Playwright report next to the reference, so the diff is inspectable
      // rather than just a number in a log.
      if (result.failures.length) {
        await test.info().attach(`${section} render`, { path: renderPath, contentType: 'image/png' })
        await test.info().attach(`${section} reference`, {
          path: `${manifest.refsDir}/${section}.png`,
          contentType: 'image/png',
        })
      }
      expect(result.failures, `${section} does not match the design`).toEqual([])
    })
  }
})
