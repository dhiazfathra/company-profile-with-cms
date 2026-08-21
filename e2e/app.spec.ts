import { test, expect } from '@playwright/test'

test.describe('homepage', () => {
  test('responds 200 and renders without console/page errors', async ({ page }, testInfo) => {
    const consoleMessages: string[] = []
    const pageErrors: string[] = []
    page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`))
    page.on('pageerror', (err) => pageErrors.push(String(err)))

    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('body')).toBeVisible()

    await testInfo.attach('console-output.txt', {
      body: consoleMessages.join('\n') || '(no console output)',
      contentType: 'text/plain',
    })

    const errorMessages = consoleMessages.filter((m) => m.startsWith('[error]'))
    expect(errorMessages, `console errors:\n${errorMessages.join('\n')}`).toHaveLength(0)
    expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toHaveLength(0)
  })

  test('desktop light screenshot', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.screenshot({ path: 'docs/e2e/homepage-desktop-light.png', fullPage: true })
  })

  test('desktop dark screenshot', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.screenshot({ path: 'docs/e2e/homepage-desktop-dark.png', fullPage: true })
  })

  test('mobile screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.screenshot({ path: 'docs/e2e/homepage-mobile.png', fullPage: true })
  })
})
