import type { BasePayload } from 'payload'
import { getPayload } from './payload'

export const DEFAULT_LOCALE = 'en'

type PayloadClient = () => Promise<BasePayload>

/**
 * Builds the `getGlobal`/`getCollection` pair over any Payload client — a
 * seam of its own, so tests can point it at a throwaway config instead of
 * the app's real one. `createContentApi(getPayload)` below is what every
 * component actually imports.
 */
export function createContentApi(getClient: PayloadClient) {
  /**
   * Phase 2 — backed by Payload. Same signature as the Phase 1 flat-JSON
   * reader it replaced: components never learn which backend is live.
   * Payload resolves the locale and falls back to `en` server-side. See
   * ADR-0004 and ADR-0005.
   */
  async function getGlobal(
    name: string,
    locale: string = DEFAULT_LOCALE,
  ): Promise<Record<string, unknown>> {
    const payload = await getClient()
    const result = await payload.findGlobal({
      slug: name,
      locale,
      fallbackLocale: DEFAULT_LOCALE,
    })
    return result as unknown as Record<string, unknown>
  }

  async function getCollection(
    name: string,
    locale: string = DEFAULT_LOCALE,
  ): Promise<Record<string, unknown>[]> {
    const payload = await getClient()
    const result = await payload.find({
      collection: name as Parameters<typeof payload.find>[0]['collection'],
      locale,
      fallbackLocale: DEFAULT_LOCALE,
      limit: 0,
    })
    return result.docs as unknown as Record<string, unknown>[]
  }

  return { getGlobal, getCollection }
}

const defaultApi = createContentApi(getPayload)
export const getGlobal = defaultApi.getGlobal
export const getCollection = defaultApi.getCollection
