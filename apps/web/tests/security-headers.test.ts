import { describe, expect, it } from 'vitest'
import nextConfig from '@/next.config'

/**
 * These headers are the whole of the site's defence for two failure shapes that
 * a green build says nothing about: an uploaded SVG executing script from this
 * origin, and the page being framed. Both are configuration, and configuration
 * is exactly what gets deleted during an unrelated refactor with every test
 * still passing. So they are asserted here by value.
 */
async function headerRule(source: string) {
  const rules = await nextConfig.headers!()
  const rule = rules.find((r) => r.source === source)
  expect(rule, `no header rule for ${source}`).toBeDefined()
  return Object.fromEntries(rule!.headers.map((h) => [h.key, h.value]))
}

describe('site-wide security headers', () => {
  it('sends the framing, sniffing and transport headers on every route', async () => {
    const headers = await headerRule('/:path*')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin')
    expect(headers['Strict-Transport-Security']).toContain('max-age=63072000')
    expect(headers['Permissions-Policy']).toContain('camera=()')
  })

  it("pins the page CSP's non-negotiable directives", async () => {
    const csp = (await headerRule('/:path*'))['Content-Security-Policy']
    // 'unsafe-inline' in script-src is a known, documented gap (the Payload
    // admin bundle). These four are not, and each one closes a distinct hole:
    // plugin embedding, <base> rewriting, cross-origin form posts, framing.
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('does not advertise the framework version', () => {
    expect(nextConfig.poweredByHeader).toBe(false)
  })
})

describe('uploaded media headers', () => {
  it('sandboxes /api/media/file/* so an uploaded SVG cannot run script', async () => {
    const headers = await headerRule('/api/media/file/:path*')
    // `sandbox` with no allow-list is the part that matters: it puts the
    // response in an opaque origin with scripting off. image/svg+xml stays
    // uploadable (the seeded icons are SVG), so this header is what stands
    // between an editor upload and same-origin stored XSS. See ADR-0021.
    expect(headers['Content-Security-Policy']).toBe("default-src 'none'; sandbox")
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
  })
})
