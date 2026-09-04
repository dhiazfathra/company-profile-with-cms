import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Img } from '@/components/Img'

vi.mock('@/lib/payload', () => ({ getPayload: () => mockPayload }))

let rows: Record<string, unknown>[] = []
const mockPayload = {
  find: async () => ({ docs: rows }),
}

async function get(filename: string) {
  const { GET } = await import('@/app/(frontend)/api/media-fallback/[filename]/route')
  return GET(new Request(`https://example.com/api/media-fallback/${filename}`), {
    params: Promise.resolve({ filename }),
  })
}

/**
 * Both halves of the outage fix, and both of them in the failing direction too
 * — a fallback nobody has watched fail is not known to fall back (ADR-0015).
 */
describe('media fallback route', () => {
  it("redirects to the row's seeded public path", async () => {
    rows = [{ sourcePath: '/img/header.png' }]
    const response = await get('header-30.png')
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://example.com/img/header.png')
  })

  it('404s for a file with no seeded counterpart, rather than redirecting to a page', async () => {
    rows = []
    const response = await get('editor-upload.png')
    expect(response.status).toBe(404)
  })

  it('refuses a protocol-relative sourcePath instead of redirecting off-origin', async () => {
    rows = [{ sourcePath: '//evil.example/x.png' }]
    const response = await get('x.png')
    expect(response.status).toBe(404)
  })

  it('refuses a backslash-prefixed sourcePath instead of redirecting off-origin', async () => {
    // `URL` treats a leading backslash as a path separator, so `/\evil.example/x.png`
    // passes the `startsWith('/')` / `!startsWith('//')` check yet still resolves to
    // `https://evil.example/x.png` — an open redirect the protocol-relative check
    // above does not catch (CWE-601).
    rows = [{ sourcePath: '/\\evil.example/x.png' }]
    const response = await get('x.png')
    expect(response.status).toBe(404)
  })
})

describe('Img', () => {
  // No global auto-cleanup in this suite's setup, so each render is torn down
  // here — otherwise the second test queries two <img alt="hero"> at once.
  afterEach(cleanup)

  it('swaps a failed media src for the fallback route', () => {
    const { getByAltText } = render(<Img src="/api/media/file/header-30.png" alt="hero" />)
    const img = getByAltText('hero')
    // endsWith, not toBe: the mount nudge described in Img.tsx reassigns `src`
    // to restart the load, and that resolves the attribute to an absolute URL.
    // Asserting the literal string would be asserting the DOM shim's URL
    // handling rather than which endpoint the image points at.
    expect(img.getAttribute('src')).toMatch(/\/api\/media\/file\/header-30\.png$/)
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe('/api/media-fallback/header-30.png')
  })

  it('does not swap back when the fallback also fails', () => {
    const { getByAltText } = render(<Img src="/api/media/file/header-30.png" alt="hero" />)
    const img = getByAltText('hero')
    fireEvent.error(img)
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe('/api/media-fallback/header-30.png')
  })

  it('leaves a static asset alone — it is already its own fallback', () => {
    const { getByAltText } = render(<Img src="/icons/arrow-linkout.svg" alt="icon" />)
    const img = getByAltText('icon')
    fireEvent.error(img)
    expect(img.getAttribute('src')).toBe('/icons/arrow-linkout.svg')
  })
})
