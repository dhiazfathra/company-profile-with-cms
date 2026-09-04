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
  // Most `Img` instances render `loading="lazy"` (see ADR-0022), so an
  // offscreen image can still have `naturalWidth === 0` here even when the
  // media route is perfectly healthy. Force every image eager...
  await page.locator('img').evaluateAll((images) => {
    for (const image of images) (image as HTMLImageElement).loading = 'eager'
  })
  // ...then wait again: forcing `eager` (and, on the "dead" test, `Img`'s own
  // onError -> setFailed(true) -> re-render with the fallback src) both start
  // fresh fetches after the first `networkidle`, and the fallback route's 302
  // to `/img/...` is one more round trip on top of that. Only after all of
  // that settles is `decode()` looking at each image's final src.
  await page.waitForLoadState('networkidle')
  return page.locator('img').evaluateAll(async (images) => {
    await Promise.all(
      images.map((image) => (image as HTMLImageElement).decode().catch(() => undefined)),
    )
    return images.map((image) => ({
      src: (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src,
      width: (image as HTMLImageElement).naturalWidth,
    }))
  })
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
