import { defineConfig, devices } from '@playwright/test'

const ROUND_TRIP = '**/cms-round-trip.spec.ts'

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e-results/artifacts',
  fullyParallel: true,
  retries: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e-results/report', open: 'never' }],
    // Machine-readable, for scripts/e2e-evidence.mjs: an evidence pack must read
    // the run's own record, never its console formatting.
    ['json', { outputFile: 'e2e-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3100',
    // Only on failure. A video, a screenshot and a trace zip per passing test
    // is a few hundred MB per run and answers a question nobody asks — the
    // evidence pack's renders come from explicit captures in
    // design-fidelity.spec.ts, not from these. Repeated local runs filled the
    // disk; CI pays the same cost on every push.
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // The round trip is the one test that writes to the database every other
      // test reads. With fullyParallel it could change Header.headline while
      // design-fidelity.spec.ts is comparing that section's render against the
      // Figma reference — a different string is a different layout, so the block
      // comparison would fail for a reason that has nothing to do with fidelity.
      testIgnore: ROUND_TRIP,
    },
    {
      // Runs alone, after everything else has finished reading the seeded state.
      // The evidence script's negative proof targets this project directly with
      // --no-deps, so it does not drag the whole suite along.
      name: 'round-trip',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ROUND_TRIP,
      dependencies: ['chromium'],
    },
  ],
  webServer: {
    command: 'bun run dev -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { E2E: '1', PAYLOAD_SECRET: process.env.PAYLOAD_SECRET ?? 'e2e-secret' },
  },
})
