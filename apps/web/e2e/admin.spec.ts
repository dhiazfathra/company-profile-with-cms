import { test, expect } from '@playwright/test'
import { watchForConsoleErrors } from './console-errors'

/**
 * The admin panel is served by Payload's own root layout, which renders its own
 * `<html>` and `<body>`. If the frontend's root layout ever wraps it again —
 * which is what happens the moment `app/layout.tsx` exists above both route
 * groups — every admin route serves nested `<html>` inside `<body>`, hydration
 * fails, and the panel still *looks* fine. That fault shipped once. These tests
 * are why it cannot ship again.
 */
test.describe('admin panel', () => {
  for (const path of ['/admin', '/admin/login']) {
    test(`${path} renders without console/page errors`, async ({ page }, testInfo) => {
      const assertClean = watchForConsoleErrors(page)

      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await expect(page.locator('body')).toBeVisible()

      await assertClean(testInfo, `console-output${path.replace(/\//g, '-')}.txt`)
    })
  }

  /**
   * A `200` from `/admin` is the server shell, not the panel. When a component
   * the config registers is missing from `app/(payload)/admin/importMap.js`,
   * Payload logs `getFromImportMap: PayloadComponent not found` on the server
   * and renders nothing — the route still answers `200`, the document still
   * carries a `<title>`, and the page is blank. That shipped to production
   * once (ADR-0016). Asserting on a control only the mounted panel draws is
   * what separates the two.
   */
  test('mounts the panel, not just the shell', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.locator('input#field-email')).toBeVisible()
    await expect(page.locator('input#field-password')).toBeVisible()
  })

  test('serves exactly one <html> element', async ({ page }) => {
    await page.goto('/admin')
    // Not page.locator('html').count() — the browser's parser silently discards
    // a nested <html>, so the DOM would read as one either way. The served HTML
    // is where a second root layout is visible.
    const html = await (await page.request.get('/admin')).text()
    expect(html.match(/<html[\s>]/g) ?? []).toHaveLength(1)
  })
})
