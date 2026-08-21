import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Each test file gets its own isolated in-memory Payload/sqlite
    // instance — set before any module (payload.config.ts included) reads
    // it, so tests never contend for a shared file-based db.
    env: {
      DATABASE_URI: ':memory:',
      PAYLOAD_SECRET: 'test-secret-not-for-prod',
    },
  },
})
