import '@testing-library/jest-dom/vitest'
import { getPayload } from '../lib/payload'
import { loadManifest } from '../scripts/gen-cms'
import { seedAll } from '../scripts/seed'

// Every test file gets its own in-memory Payload instance (see
// vitest.config.ts's DATABASE_URI), seeded once from content/*.json so
// component and content-seam tests render against real data.
const payload = await getPayload()
await seedAll(payload, loadManifest())
