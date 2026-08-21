import { test, expect } from '@playwright/test'
import { watchForConsoleErrors } from './console-errors'

test.describe('homepage', () => {
  test('responds 200 and renders without console/page errors', async ({ page }, testInfo) => {
    const assertClean = watchForConsoleErrors(page)

    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('body')).toBeVisible()

    await assertClean(testInfo)
  })

  test('desktop light screenshot', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.screenshot({ path: '../../docs/e2e/homepage-desktop-light.png', fullPage: true })
  })

  test('desktop dark screenshot', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.screenshot({ path: '../../docs/e2e/homepage-desktop-dark.png', fullPage: true })
  })

  test('mobile screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.screenshot({ path: '../../docs/e2e/homepage-mobile.png', fullPage: true })
  })
})
