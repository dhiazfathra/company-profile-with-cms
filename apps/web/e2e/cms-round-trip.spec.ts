import { test, expect, type APIRequestContext } from '@playwright/test'

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
 * It edits through the REST API rather than by driving the admin UI. The claim
 * under test is that the CMS is the page's source of truth, not that a
 * particular form widget works; driving the UI would be testing Payload's admin,
 * which Payload already tests, and would fail for reasons unrelated to the seam.
 */
const SECTION = 'Header'
const FIELD = 'headline'
const HEADLINE = `[data-section="${SECTION}"] h1`

const EMAIL = process.env.E2E_USER_EMAIL
const PASSWORD = process.env.E2E_USER_PASSWORD

/**
 * Reads of globals require auth, so the test authenticates as the account
 * `bun run seed` creates when E2E_USER_EMAIL/E2E_USER_PASSWORD are set.
 *
 * Skipping when they are absent rather than failing would let this test quietly
 * stop running — the exact failure mode that let a green hero band ship. If the
 * credentials are missing, that is a broken setup and it says so.
 */
async function login(request: APIRequestContext): Promise<string> {
  expect(
    EMAIL && PASSWORD,
    'E2E_USER_EMAIL and E2E_USER_PASSWORD must be set, and `bun run seed` run with them, ' +
      'so this test can edit through the API as an editor would',
  ).toBeTruthy()

  const res = await request.post('/api/users/login', {
    data: { email: EMAIL, password: PASSWORD },
  })
  expect(res.status(), await res.text()).toBe(200)
  const token = (await res.json()).token as string
  expect(token, 'login returned no token').toBeTruthy()
  return token
}

test.describe('CMS round trip', () => {
  test('a value changed in the CMS appears on the landing page', async ({ page, request }) => {
    const token = await login(request)
    const auth = { Authorization: `JWT ${token}` }

    const before = await page.goto('/')
    expect(before?.status()).toBe(200)
    const original = (await page.locator(HEADLINE).first().innerText()).trim()
    expect(original.length).toBeGreaterThan(0)

    // Unique per run, so a cached render cannot pass for a fresh one and the
    // string cannot exist anywhere in the repository.
    const edited = `CMS round trip ${Date.now()}`
    const write = async (value: string) =>
      request.post(`/api/globals/${SECTION}?locale=en`, {
        headers: auth,
        data: { [FIELD]: value },
      })

    const update = await write(edited)
    expect(update.status(), await update.text()).toBe(200)

    try {
      await page.goto('/')
      await expect(page.locator(HEADLINE).first()).toHaveText(edited)
      // The value is in the HTML the server sent, not only in a DOM the client
      // could have built on its own.
      expect(await (await request.get('/')).text()).toContain(edited)
    } finally {
      // Leave the database as found: this test has to be re-runnable, and
      // design-fidelity.spec.ts must not compare a mutated headline to Figma.
      const restore = await write(original)
      expect(restore.status(), await restore.text()).toBe(200)
    }

    await page.goto('/')
    await expect(page.locator(HEADLINE).first()).toHaveText(original)
  })
})
