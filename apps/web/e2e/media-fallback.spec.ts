import { test, expect } from '@playwright/test'

/**
 * Reproduces the 2026-08-30 outage in the browser and asserts the site
 * survives it.
 *
 * That outage was a suspended Vercel Blob store: `/api/media/file/...`
 * answered nothing for four days while the seeded bytes sat on the same domain
 * under `/img/...` (docs/incidents/2026-09-03-media-blob-store-suspended.md,
 * ADR-0020). Aborting exactly those requests is the same failure the browser
 * saw, and the only way to know the fallback works is to watch it happen.
 *
 * The control case matters as much as the failing one: an image that loads when
 * nothing is broken proves the fallback is not silently in use all the time,
 * which would mean editor uploads never reach the page.
 */
async function renderedWidths(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  return page.locator('img').evaluateAll((images) =>
    images.map((image) => ({
      src: (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src,
      width: (image as HTMLImageElement).naturalWidth,
    })),
  )
}

test.describe('media fallback', () => {
  test('every image still renders when the media route is dead', async ({ page }) => {
    await page.route('**/api/media/file/**', (route) => route.abort())

    const images = await renderedWidths(page)
    expect(images.length).toBeGreaterThan(0)

    const broken = images.filter((image) => image.width === 0)
    expect(broken, `images with no bytes: ${JSON.stringify(broken, null, 2)}`).toEqual([])

    // Not just "something rendered" — the fallback specifically is what served
    // it. Without this, a cached blob response would pass the assertion above.
    const fellBack = images.filter((image) => /\/img\/|\/icons\//.test(image.src))
    expect(fellBack.length).toBeGreaterThan(0)
  })

  test('serves media from the CMS route when it is healthy', async ({ page }) => {
    const images = await renderedWidths(page)
    const broken = images.filter((image) => image.width === 0)
    expect(broken, `images with no bytes: ${JSON.stringify(broken, null, 2)}`).toEqual([])
    expect(images.some((image) => image.src.includes('/api/media/file/'))).toBe(true)
  })
})
