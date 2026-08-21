import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'

// Real fixture values — asserted against, not hardcoded guesses.
const globalFixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), 'tests/fixtures/content/globals/Sample.json'),
    'utf8',
  ),
) as Record<string, string>

const EN_HEADLINE = globalFixture.headline_en
const CTA_HREF = globalFixture.ctaHref

test.describe('content seam (lib/content.ts via a real HTTP request)', () => {
  test('renders the English value for ?locale=en', async ({ page }) => {
    const response = await page.goto('/e2e-seam?locale=en')
    expect(response?.status()).toBe(200)
    await expect(page.getByTestId('headline')).toHaveText(EN_HEADLINE)
    await expect(page.getByTestId('ctaHref')).toHaveText(CTA_HREF)
  })

  test('falls back to English when the requested locale has no translation', async ({
    page,
  }) => {
    const response = await page.goto('/e2e-seam?locale=fr')
    expect(response?.status()).toBe(200)
    await expect(page.getByTestId('headline')).toHaveText(EN_HEADLINE)
    await page.screenshot({ path: '../../docs/e2e/seam-page.png', fullPage: true })
  })

  test('never renders a suffixed key in the HTML', async ({ page }) => {
    await page.goto('/e2e-seam?locale=fr')
    const html = await page.content()
    expect(html).not.toContain('headline_en')
    expect(html).not.toContain('headline_fr')
  })

  test('404s when E2E is not set on the server', async ({}, testInfo) => {
    testInfo.setTimeout(90_000)
    // The shared webServer always runs with E2E=1, so the gate itself is
    // exercised against a throwaway server that boots without it.
    const port = 3199
    let proc: ChildProcess | undefined
    try {
      proc = spawn('bun', ['run', 'dev', '--', '--port', String(port)], {
        cwd: process.cwd(),
        env: { ...process.env, E2E: '', NEXT_DIST_DIR: '.next-e2e-throwaway' },
        stdio: 'pipe',
      })

      const deadline = Date.now() + 60_000
      let ready = false
      while (Date.now() < deadline && !ready) {
        try {
          await fetch(`http://localhost:${port}/`)
          ready = true
        } catch {
          await new Promise((r) => setTimeout(r, 500))
        }
      }
      expect(ready, 'throwaway dev server never became ready').toBe(true)

      const res = await fetch(`http://localhost:${port}/e2e-seam?locale=en`)
      expect(res.status).toBe(404)
    } finally {
      proc?.kill('SIGTERM')
    }
  })
})
