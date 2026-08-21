import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const DEFAULT_LOCALE = 'en'

const SUFFIXED = /^(.+)_([a-z]{2}(?:-[A-Z]{2})?)$/

/**
 * Resolves locale-suffixed keys down to plain ones for a single locale.
 *
 * Phase 1 only. Phase 2 deletes this: Payload resolves the locale and the
 * fallback server-side, and returns the same unsuffixed shape. Components
 * therefore never observe which phase they are running in — that is the whole
 * point of this module. See ADR-0004 and ADR-0005.
 */
export function strip(
  raw: Record<string, unknown>,
  locale: string = DEFAULT_LOCALE,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const exact = new Set<string>()

  for (const [key, value] of Object.entries(raw)) {
    const match = SUFFIXED.exec(key)
    if (!match) {
      out[key] = value
      continue
    }
    const [, field, keyLocale] = match
    if (keyLocale === locale) {
      out[field] = value
      exact.add(field)
    } else if (keyLocale === DEFAULT_LOCALE && !exact.has(field)) {
      // Fallback, but never over an exact match — regardless of key order.
      out[field] = value
    }
  }

  return out
}

const read = async (dir: string, kind: string, name: string) =>
  JSON.parse(await readFile(path.join(process.cwd(), dir, kind, `${name}.json`), 'utf8'))

export async function getGlobal(
  name: string,
  locale: string = DEFAULT_LOCALE,
  dir = 'content',
): Promise<Record<string, unknown>> {
  return strip(await read(dir, 'globals', name), locale)
}

export async function getCollection(
  name: string,
  locale: string = DEFAULT_LOCALE,
  dir = 'content',
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = await read(dir, 'collections', name)
  return items.map((item) => strip(item, locale))
}
