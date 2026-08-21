import { expect, type Page, type TestInfo } from '@playwright/test'

/**
 * Records every console message and uncaught page error for the rest of the
 * test, and asserts there were none of either.
 *
 * A hydration mismatch — two `<html>` elements from two root layouts, say —
 * renders a page that looks correct and reports itself only in the console.
 * Nothing else in this suite can see that class of fault, so every route the
 * app serves gets this guard, not just the ones whose pixels we compare.
 */
export function watchForConsoleErrors(page: Page) {
  const consoleMessages: string[] = []
  const pageErrors: string[] = []

  page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => pageErrors.push(String(err)))

  return async function assertClean(testInfo: TestInfo, label = 'console-output.txt') {
    await testInfo.attach(label, {
      body: consoleMessages.join('\n') || '(no console output)',
      contentType: 'text/plain',
    })

    const errorMessages = consoleMessages.filter((m) => m.startsWith('[error]'))
    expect(errorMessages, `console errors:\n${errorMessages.join('\n')}`).toHaveLength(0)
    expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toHaveLength(0)
  }
}
