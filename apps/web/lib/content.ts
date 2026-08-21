import type { BasePayload } from 'payload'
import { getPayload } from './payload'

export const DEFAULT_LOCALE = 'en'

type PayloadClient = () => Promise<BasePayload>

/**
 * Payload's local API auto-populates `upload` relation fields into their
 * full media doc (depth > 0 by default). Components only ever want the
 * URL string — the same shape the Phase 1 flat-JSON reader gave them — so
 * flatten any populated media object down to its `.url` here, once, instead
 * of every section component learning Payload's upload-field shape.
 */
function flattenMedia(doc: Record<string, unknown>): Record<string, unknown> {
  const flattened: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    flattened[key] =
      value && typeof value === 'object' && typeof (value as { url?: unknown }).url === 'string'
        ? (value as { url: string }).url
        : value
  }
  return flattened
}

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
    return flattenMedia(result as unknown as Record<string, unknown>)
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
    return (result.docs as unknown as Record<string, unknown>[]).map(flattenMedia)
  }

  return { getGlobal, getCollection }
}

const defaultApi = createContentApi(getPayload)
export const getGlobal = defaultApi.getGlobal
export const getCollection = defaultApi.getCollection
