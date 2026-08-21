import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'

/**
 * The claim Phase 2 exists to make: an editor changes a value in the CMS and the
 * public page shows it.
 *
 * Every other check in this suite would pass on a site whose copy was still
 * baked into its components — the seed puts the same strings in the CMS that
 * Phase 1 hardcoded, so "the headline is on the page" says nothing about where
 * the page read it from. This test writes a value no fixture contains and
 * requires the page to follow, which a hardcoded string cannot do.
 *
 * It drives the admin UI rather than the REST API. Editing through the API would
 * prove the same seam with less to go wrong, but it would prove it to a machine:
 * the artefact a reviewer can check is the editor's own journey — the admin form
 * holding the old value, the same form holding the new one, and the page before
 * and after. So this test walks that path and captures it. `values.json` and the
 * screenshots it writes are what scripts/e2e-evidence.mjs puts in the report; if
 * this test stops running, that script fails rather than reporting a stale pack.
 */
const SECTION = 'Header'
const FIELD = 'headline'
const HEADLINE = `[data-section="${SECTION}"] h1`
const ADMIN_URL = `/admin/globals/${SECTION}`
const FIELD_INPUT = `#field-${FIELD}`

const EMAIL = process.env.E2E_USER_EMAIL
const PASSWORD = process.env.E2E_USER_PASSWORD

const EVIDENCE = path.join(process.cwd(), 'e2e-results/round-trip')

/**
 * Numbered, because the order is the argument: the report shows these in
 * sequence and a reader has to be able to see which state came before which.
 */
const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) })

/**
 * Logs in through the admin form, not the API. A cookie set by the real login
 * page is also what authorises the restore at the end, so nothing here needs to
 * handle a token.
 */
async function login(page: Page) {
  expect(
    EMAIL && PASSWORD,
    'E2E_USER_EMAIL and E2E_USER_PASSWORD must be set, and `bun run seed` run with them, ' +
      'so this test can sign in to the admin UI as an editor would',
  ).toBeTruthy()

  await page.goto('/admin/login')
  await page.locator('#field-email').fill(EMAIL as string)
  await page.locator('#field-password').fill(PASSWORD as string)
  await shot(page, '2-admin-login')
  await page.locator('form button[type="submit"]').click()
  // The dashboard, not the login form: a failed login re-renders /admin/login
  // with an error and every later step would fail somewhere less obvious.
  await expect(page.locator('#field-email')).toHaveCount(0)
}

test.describe('CMS round trip', () => {
  test('a value changed in the CMS appears on the landing page', async ({ page }) => {
    mkdirSync(EVIDENCE, { recursive: true })

    const before = await page.goto('/')
    expect(before?.status()).toBe(200)
    await shot(page, '1-landing-before')

    await login(page)

    await page.goto(ADMIN_URL)
    const input = page.locator(FIELD_INPUT)
    await expect(input).toBeVisible()
    const original = ((await input.inputValue()) ?? '').trim()
    expect(original.length, `${ADMIN_URL} shows no value for ${FIELD}`).toBeGreaterThan(0)
    await shot(page, '3-admin-before')

    // The CMS's value and the page's are the same thing before anything is
    // edited. This is the assertion the hardcoded-headline proof in
    // scripts/e2e-evidence.mjs trips: a baked-in component disagrees with the
    // admin form here.
    await page.goto('/')
    await expect(page.locator(HEADLINE).first()).toHaveText(original)

    // Unique per run, so a cached render cannot pass for a fresh one and the
    // string cannot exist anywhere in the repository.
    const edited = `CMS round trip ${Date.now()}`

    try {
      await page.goto(ADMIN_URL)
      await input.fill(edited)
      await page.locator('#action-save').click()
      // Payload keeps the form mounted after a save, so the value in the input
      // proves nothing on its own — a reload is what shows it was persisted.
      await page.reload()
      await expect(page.locator(FIELD_INPUT)).toHaveValue(edited)
      await shot(page, '4-admin-after')

      await page.goto('/')
      await expect(page.locator(HEADLINE).first()).toHaveText(edited)
      await shot(page, '5-landing-after')

      // The value is in the HTML the server sent, not only in a DOM the client
      // could have built on its own.
      expect(await (await page.request.get('/')).text()).toContain(edited)

      // Read by scripts/e2e-evidence.mjs. Written from what this run observed —
      // `original` came out of the admin form and `edited` was required on the
      // page above, so the report cannot show a before/after the run did not see.
      writeFileSync(
        path.join(EVIDENCE, 'values.json'),
        JSON.stringify(
          { section: SECTION, field: FIELD, adminUrl: ADMIN_URL, before: original, after: edited },
          null,
          2,
        ) + '\n',
      )
    } finally {
      // Leave the database as found: this test has to be re-runnable, and
      // design-fidelity.spec.ts must not compare a mutated headline to Figma.
      // The admin login's cookie authorises this.
      const restore = await page.request.post(`/api/globals/${SECTION}?locale=en`, {
        data: { [FIELD]: original },
      })
      expect(restore.status(), await restore.text()).toBe(200)
    }

    await page.goto('/')
    await expect(page.locator(HEADLINE).first()).toHaveText(original)
  })
})
