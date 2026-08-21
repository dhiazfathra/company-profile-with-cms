# End-to-end test evidence

## Reproduction

```bash
bun install
bunx playwright install chromium --with-deps
bun run e2e            # runs the suite (starts `bun run dev` itself)
bun run e2e:report      # opens the HTML report with traces/videos/screenshots
```

`bun run e2e` runs `playwright test` against `playwright.config.ts`, which
starts `bun run dev` on port 3100 via Playwright's `webServer`, so no manual
setup is required. Every test captures a screenshot, a video, and a trace
(`e2e-results/artifacts/`) plus an HTML report (`e2e-results/report/`) — none
of that is committed to the repo (see `.gitignore`); in CI it is uploaded as a
workflow artifact by `.github/workflows/e2e.yml`.

## Environment this run was performed in

| | |
|---|---|
| OS | macOS (Darwin 25.6.0, arm64) |
| Node | v24.16.0 (repo requires `>=20.9.0`, pinned to `20.9.0` in `.nvmrc`; CI uses the `.nvmrc` version) |
| Bun | 1.3.11 |
| Playwright | 1.62.1 (`@playwright/test`), Chromium only |
| Commit | `62c3aad6400f813f2cff34c3155da748cd1b1c16` |

## Results

```
Running 12 tests using 4 workers

  ✓ e2e/app.spec.ts › desktop light screenshot
  ✓ e2e/app.spec.ts › desktop dark screenshot
  ✓ e2e/app.spec.ts › mobile screenshot
  ✓ e2e/app.spec.ts › responds 200 and renders without console/page errors
  ✓ e2e/cli.spec.ts › malformed JSON exits 1 with a controlled message
  ✓ e2e/cli.spec.ts › missing manifest exits 1 with a controlled message
  ✓ e2e/cli.spec.ts › valid manifest exits 0 and prints the section count
  ✓ e2e/cli.spec.ts › invalid manifest (duplicate section names) exits 1 and names the offending path
  ✓ e2e/content-seam.spec.ts › renders the English value for ?locale=en
  ✓ e2e/content-seam.spec.ts › never renders a suffixed key in the HTML
  ✓ e2e/content-seam.spec.ts › falls back to English when the requested locale has no translation
  ✓ e2e/content-seam.spec.ts › 404s when E2E is not set on the server

  12 passed (5.9s)
```

Existing suites stayed green throughout: `bun run test` (19/19), `bun run
lint` (clean), `bun run build` (succeeds).

## What this evidence does and does NOT prove

**Does prove:**
- The Next.js app boots, serves HTTP 200, and renders with no console or page
  errors, in both light/dark colour schemes and at desktop/mobile viewports.
- `lib/content.ts`'s seam (`getGlobal`) is exercised through a real HTTP
  request end to end: locale resolution and English fallback work against the
  actual fixture files, and — the assertion that matters for the Phase 2
  migration — no `_en`-suffixed key ever leaks into rendered HTML.
- The test-only `/e2e-seam` route is gated: it 404s on any server started
  without `E2E=1`, so it cannot ship reachable in a normal deploy.
- `scripts/validate-manifest.ts` handles all four real CLI paths (missing
  file, malformed JSON, valid manifest, invalid/duplicate sections) with
  controlled exit codes and messages, not stack traces.

**Does NOT prove:**
- That the site looks or behaves like the intended company profile. The
  homepage screenshots (`homepage-desktop-light.png`,
  `homepage-desktop-dark.png`, `homepage-mobile.png`) show the **unmodified
  Next.js starter page** — `app/page.tsx` has not been touched. Tasks 4-6
  (Figma extraction, section components, static export) are not implemented;
  they are blocked because the Figma MCP has no edit access to the case-study
  file. There is no designed page to test yet.
- Anything about Payload/Phase 2, since that phase doesn't exist yet.
- Cross-browser behaviour: only Chromium is installed and tested.

## Screenshots

| | |
|---|---|
| ![desktop light](homepage-desktop-light.png) Desktop, light scheme (Next.js starter) | ![desktop dark](homepage-desktop-dark.png) Desktop, dark scheme (Next.js starter) |
| ![mobile](homepage-mobile.png) Mobile, 375×812 (Next.js starter) | ![seam](seam-page.png) `/e2e-seam` — real content resolved through `lib/content.ts` |
