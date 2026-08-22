import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  test,
  expect,
  request as playwrightRequest,
  type Page,
  type APIRequestContext,
} from '@playwright/test'
import { casesFor, type Inventory, type PageInfo } from '../scripts/cms-discover'

/**
 * The field-by-field matrix for one CMS page, driven by what
 * `scripts/cms-discover.ts` found in the running config — never by a list
 * written here. Adding a section to site.manifest.json therefore adds its tests;
 * nothing in this file names a field.
 *
 * One test per (field, case), because the point of the pack is a reviewer being
 * able to read which case failed. A loop inside one test reports "cms-fields
 * failed" and sends them to a trace.
 *
 * Every case mutates the database, so this runs in its own Playwright project,
 * serially, after every read-only spec has finished — same reason
 * cms-round-trip.spec.ts does. Each field's original value is captured before
 * its cases run and restored after, so the suite is re-runnable and
 * design-fidelity.spec.ts never compares a mutated section against Figma.
 */

const PAGE = process.env.CMS_E2E_PAGE
const EVIDENCE = process.env.CMS_E2E_EVIDENCE
const INVENTORY = process.env.CMS_E2E_INVENTORY
const EMAIL = process.env.E2E_USER_EMAIL
const PASSWORD = process.env.E2E_USER_PASSWORD

// Not test.skip(). A missing variable means the runner was bypassed, and a
// skipped test reads as "nothing to check here" in every report that renders it.
if (!PAGE || !EVIDENCE || !INVENTORY) {
  throw new Error(
    'cms-fields.spec.ts requires CMS_E2E_PAGE, CMS_E2E_EVIDENCE and CMS_E2E_INVENTORY. ' +
      'Run it through `bun scripts/cms-e2e.mjs <Page>` from the repository root, which sets all three.',
  )
}

const inventory: Inventory = JSON.parse(readFileSync(INVENTORY, 'utf8'))
const target = inventory.pages.find((p) => p.page === PAGE)
if (!target) {
  throw new Error(
    `CMS_E2E_PAGE=${PAGE} is not in the discovered inventory. Known pages: ` +
      inventory.pages.map((p) => p.page).join(', '),
  )
}

const LOG = path.join(EVIDENCE, 'logs', 'cases.jsonl')
mkdirSync(path.dirname(LOG), { recursive: true })

/**
 * One line per case, appended as it completes. The report is assembled from
 * this and from Playwright's JSON report — a case that never ran leaves no line,
 * so the report cannot claim coverage the run did not have.
 */
function record(entry: Record<string, unknown>) {
  appendFileSync(LOG, JSON.stringify(entry) + '\n')
}

/**
 * Whether a saved value reached the served HTML.
 *
 * Not a plain `includes`. React escapes what it interpolates, so a value
 * containing `&`, `<`, `"` or `'` is *correctly* absent from the HTML in raw
 * form; the first version of this check reported the special-characters case of
 * every field as "not rendered", and the report concluded no component rendered
 * the field.
 *
 * The fix decodes the HTML rather than re-encoding the value. Encoding the value
 * only works if this function's escaping rules match the renderer's exactly —
 * and the `special` case value carries `&`, `"`, `'`, `<` and `>` at once, so a
 * renderer that escapes a *subset* of them matches neither form and produces the
 * same false finding one layer down.
 */
function decodeEntities(html: string): string {
  return (
    html
      .replace(/&(?:#x27|#39|apos);/g, "'")
      .replace(/&(?:quot|#34);/g, '"')
      .replace(/&(?:lt|#60);/g, '<')
      .replace(/&(?:gt|#62);/g, '>')
      // Ampersand last: decoding it first would turn `&amp;lt;` into `<`.
      .replace(/&(?:amp|#38);/g, '&')
  )
}

function appearsIn(html: string, value: string): boolean {
  return html.includes(value) || decodeEntities(html).includes(value)
}

async function login(page: Page) {
  expect(
    EMAIL && PASSWORD,
    'E2E_USER_EMAIL and E2E_USER_PASSWORD must be set, and `bun run seed` run with them, ' +
      'so this suite can sign in to the admin panel as an editor would',
  ).toBeTruthy()
  await page.goto('/admin/login')
  await page.locator('#field-email').fill(EMAIL as string)
  await page.locator('#field-password').fill(PASSWORD as string)
  await page.locator('form button[type="submit"]').click()
  await expect(page.locator('#field-email')).toHaveCount(0)
}

/** Admin URL of the document being edited. A collection edits its first row. */
async function documentUrl(page: Page, info: PageInfo): Promise<string> {
  if (info.kind === 'global') return info.adminUrl
  await page.goto(info.adminUrl)
  const first = page.locator('tbody tr a').first()
  await expect(
    first,
    `${info.adminUrl} lists no rows — run \`bun run seed\` before testing a collection`,
  ).toBeVisible()
  const href = await first.getAttribute('href')
  // Asserted here rather than left to fail at the first `page.goto`, where the
  // message would be about an invalid URL and point away from the list markup.
  expect(href, `the first row of ${info.adminUrl} has no href to follow`).toBeTruthy()
  return href as string
}

/** REST endpoint that can write the field back without going through the form. */
function restoreUrl(info: PageInfo, docUrl: string): string {
  if (info.kind === 'global') return `/api/globals/${info.page}?locale=${inventory.locales[0]}`
  return `/api/${info.page}/${docUrl.split('/').pop()}?locale=${inventory.locales[0]}`
}

async function restore(
  request: APIRequestContext,
  info: PageInfo,
  docUrl: string,
  field: string,
  value: string,
) {
  const url = restoreUrl(info, docUrl)
  // POST for a global, PATCH for a collection row — Payload's REST API offers a
  // global exactly two operations, GET and POST, so trying PATCH first spent a
  // request learning something the config already knew.
  const response =
    info.kind === 'global'
      ? await request.post(url, { data: { [field]: value } })
      : await request.patch(url, { data: { [field]: value } })
  expect(
    response.status(),
    `restoring ${info.page}.${field} failed: ${await response.text()}`,
  ).toBeLessThan(400)
}

/**
 * Saves the form and returns the response Payload sent, so a case can assert on
 * the status rather than on whatever the panel decided to render. Waiting for
 * the response is also what keeps the later reload from reading the old row.
 */
async function save(page: Page, info: PageInfo): Promise<{ status: number; body: string }> {
  const endpoint = info.kind === 'global' ? `/api/globals/${info.page}` : `/api/${info.page}`
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes(endpoint) && ['POST', 'PATCH'].includes(r.request().method()),
    ),
    page.locator('#action-save').click(),
  ])
  return { status: response.status(), body: await response.text() }
}

/**
 * Hidden fields are excluded, and the report says so rather than counting them.
 * `admin.hidden` means the panel renders no input at all — `_seedIndex` is the
 * generator's row identity, not an editor's field — so every case for one fails
 * on a missing `#field-…` locator and reports nothing about the CMS. Driving
 * them would need the REST API, which is not the journey this suite exists to
 * show.
 */
const fields = target.fields.filter((f) => !f.hidden && casesFor(f).length > 0)

test.describe.configure({ mode: 'serial' })

test.describe(`CMS fields — ${target.page}`, () => {
  for (const field of fields) {
    test.describe(field.name, () => {
      // Shared across this field's cases: one login, one original value, one
      // restore. A per-case login would triple the run for no extra coverage.
      let docUrl: string | undefined
      let original: string | undefined

      test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage()
        await login(page)
        docUrl = await documentUrl(page, target)
        await page.goto(docUrl)
        original = await page.locator(`#field-${field.name}`).inputValue()
        record({ event: 'baseline', field: field.name, docUrl, original })
        await page.close()
      })

      test.afterAll(async ({ browser }) => {
        // Playwright runs afterAll even when beforeAll threw. Restoring with
        // `original === undefined` sends `{field: undefined}`, JSON.stringify
        // drops the key, Payload answers 200, and the database keeps the last
        // case's value — a silent end to the re-runnability the header promises.
        record({ event: 'restore', field: field.name, attempted: original !== undefined })
        if (docUrl === undefined || original === undefined) {
          throw new Error(
            `${target.page}.${field.name}: setup failed before the original value was read, so ` +
              'nothing was restored. The field still holds whatever the last case wrote — ' +
              'run `bun run --cwd apps/web seed` before trusting this database again.',
          )
        }
        const page = await browser.newPage()
        await login(page)
        await restore(page.request, target, docUrl, field.name, original)
        await page.close()
      })

      for (const kase of casesFor(field)) {
        test(`${kase.id} (${kase.kind}) — ${kase.why}`, async ({ page }) => {
          expect(docUrl, 'setup did not resolve a document to edit').toBeTruthy()
          await login(page)
          await page.goto(docUrl as string)
          const input = page.locator(`#field-${field.name}`)
          await expect(input, `${docUrl} has no input for ${field.name}`).toBeVisible()

          // What is in the database right now — which is the previous case's
          // value, not the field's original. A rejected save has to leave *this*
          // untouched; comparing against the original instead reported a clean
          // rejection as a failure.
          const persisted = await input.inputValue()

          await input.fill(kase.value)
          const saved = await save(page, target)

          if (kase.expect === 'rejected') {
            expect(
              saved.status,
              `${field.name}=${JSON.stringify(kase.value.slice(0, 60))} was accepted with ${saved.status}, ` +
                `but ${kase.why}. Response: ${saved.body.slice(0, 400)}`,
            ).toBeGreaterThanOrEqual(400)
            // A refused save must not have written anything: a 4xx that still
            // persisted half the document is worse than either outcome alone.
            await page.reload()
            await expect(
              page.locator(`#field-${field.name}`),
              'the save was refused but the database changed anyway — a partial write is worse than either outcome on its own',
            ).toHaveValue(persisted)
            record({
              event: 'case',
              field: field.name,
              case: kase.id,
              kind: kase.kind,
              outcome: 'rejected-as-required',
              status: saved.status,
            })
            return
          }

          expect(
            saved.status,
            `${field.name}=${JSON.stringify(kase.value.slice(0, 60))} was refused with ${saved.status}, ` +
              `but ${kase.why}. Response: ${saved.body.slice(0, 400)}`,
          ).toBeLessThan(400)

          // The form keeps the typed value mounted after a save, so a reload is
          // the only thing that shows what was persisted — and `toHaveValue` is
          // exact, which is what catches a silent trim or truncation.
          await page.reload()
          await expect(
            page.locator(`#field-${field.name}`),
            `${field.name} came back from the database different from what was saved — ` +
              'a trim or a truncation, not a save',
          ).toHaveValue(kase.value)

          // Persistence, second half: what the public page serves. Read from the
          // HTTP response rather than the DOM, so a value the client assembled
          // cannot pass for one the server rendered — and from a context with no
          // cookies, because `page.request` carries the admin session this test
          // logged in with. A value only an authenticated user can see is not
          // evidence about the public page, which is what the report calls it.
          let rendered: boolean | null = null
          if (target.section && kase.value.trim().length > 0) {
            const anonymous = await playwrightRequest.newContext({
              baseURL: page.url().replace(/(^https?:\/\/[^/]+).*/, '$1'),
            })
            const html = await (await anonymous.get('/')).text()
            await anonymous.dispose()
            rendered = appearsIn(html, kase.value)
            if (kase.kind === 'injection') {
              // The value must reach the page as data, not as markup. Checked in
              // the DOM rather than in the HTML string because the browser's
              // parser is what decides which of the two it was: if the section
              // contains a `script` element or an `img` with an `onerror`, the
              // value was interpolated as HTML.
              await page.goto('/')
              await expect(
                page.locator(
                  `[data-section="${target.section}"] script, [data-section="${target.section}"] img[onerror]`,
                ),
                'the injected markup was parsed into elements — the value is rendered as HTML, not as data',
              ).toHaveCount(0)
              // Whether the value reached the page at all is `rendered` above,
              // which allows for the escaping. Asserting on visible text here
              // would fail for a field that renders into an attribute — `alt`,
              // `href` — where escaped is the only correct outcome and there is
              // no text node to read.
            }
          }
          record({
            event: 'case',
            field: field.name,
            case: kase.id,
            kind: kase.kind,
            outcome: 'saved',
            status: saved.status,
            section: target.section,
            renderedOnPublicPage: rendered,
          })
        })
      }
    })
  }
})
