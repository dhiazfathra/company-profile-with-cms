import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'

/**
 * Response headers every route gets.
 *
 * Why a static CSP rather than a per-request nonce: the frontend is
 * `force-dynamic` today but the Payload admin bundle evaluates inline script
 * that a nonce alone does not cover, and a policy that breaks /admin would be
 * removed within the day. What this policy does buy, and a header-less
 * deployment does not have: no framing (clickjacking), no plugin/object
 * embedding, no `<base>` rewrite of every relative URL on the page, no
 * cross-origin form posts, and no MIME sniffing of an uploaded media file into
 * something executable.
 *
 * What it does NOT cover — `'unsafe-inline'` in script-src means CSP is not a
 * defence against injected inline script here. React's escaping is. Removing
 * `'unsafe-inline'` needs the admin bundle checked against a nonce first.
 */
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // 'unsafe-eval' is Payload's admin bundle in dev (React Refresh).
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      // blob:/data: are the admin's upload previews; https: is Vercel Blob.
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // Vercel Blob uploads go direct from the admin to the store.
      "connect-src 'self' https://*.vercel-storage.com",
      "media-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      // Only in production: this directive applies to every insecure absolute
      // URL a page fetches, regardless of the scheme the page itself was
      // served over. `next dev` (and every e2e/CI run against it) is plain
      // http with no TLS listener, so a same-origin http:// redirect target
      // — e.g. `/api/media-fallback/*`'s 302 to `/img/...` — gets rewritten to
      // https and fails with ERR_SSL_PROTOCOL_ERROR. Production is Vercel,
      // always https, so this never fires there and the directive is a no-op
      // in the case that matters.
      ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
    ].join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  // Phase 2: the admin panel and its API routes are server-rendered, so the
  // site can no longer be a static export (Phase 1's `output: 'export'`).
  // Lets a second, throwaway `next dev` build into its own directory instead
  // of lock-contending with the main dev server's .next/.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // The framework version is a free hint to anyone scanning for known CVEs.
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Uploaded media is attacker-influenced bytes served from this site's own
      // origin, so it gets its own, far tighter policy than the page does.
      // `sandbox` with no allow-list drops the response into an opaque origin
      // with scripting off, which is what actually neutralises an uploaded
      // SVG — an SVG is a script container, and `image/svg+xml` has to stay on
      // the Media collection's mimeTypes allowlist because the seeded icons are
      // SVG. Rendering through <img> is unaffected: an <img> never runs script
      // in the referenced document, so this only bites the case that matters,
      // navigating straight to /api/media/file/<name>.
      //
      // The two halves are one control. Dropping this header while keeping
      // image/svg+xml uploadable restores same-origin stored XSS. See ADR-0021.
      {
        source: '/api/media/file/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'none'; sandbox" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Disposition', value: 'inline' },
          // Every media response was previously uncacheable, so each of the
          // page's eleven images was re-proxied from Blob storage on every
          // navigation. An hour of browser cache with a day of
          // stale-while-revalidate behind it makes a repeat view cost nothing
          // and still surfaces an editor's replacement within the hour.
          //
          // Deliberately not `immutable`: Payload's filename is not a content
          // hash, so a replaced image can reuse a name and an immutable
          // response would pin the old bytes until the cache is cleared.
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
      // Hashed build output — the filename changes whenever the bytes do, so
      // this is the one place `immutable` is correct.
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default withPayload(nextConfig)
