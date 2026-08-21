import { defineConfig, devices } from '@playwright/test'

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
