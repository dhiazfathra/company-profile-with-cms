import { NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'

/**
 * Last resort for a media file whose storage is unreachable: redirect to the
 * `public/` asset the row was seeded from.
 *
 * Why this exists. Every media file is served through
 * `/api/media/file/<filename>`, which proxies Vercel Blob. On 2026-08-30 that
 * store was suspended for inactive billing, so it answered 403 to every read
 * and every image on the deployment 404'd for four days — while the very same
 * bytes sat one path away on the same domain, because the seed uploads them
 * *from* `public/img/`, which ships in the deployment bundle
 * (docs/incidents/2026-09-03-media-blob-store-suspended.md, ADR-0020).
 *
 * Why by lookup rather than by deriving the path from the filename. Payload
 * suffixes uploads on collision (`header.png` becomes `header-30.png`), and
 * basenames are not unique across `public/` — `/icons/logo.png` and
 * `/img/logo.png` collide, which is why the seed records the full public path
 * in `sourcePath` in the first place. Reversing a filename into a path would
 * hand back the wrong image with nothing reporting it.
 *
 * Why a redirect rather than reading the file. `public/` is served by the CDN,
 * not guaranteed to be present on the filesystem a serverless function sees.
 * A 302 to the static path is both smaller and the thing that actually works
 * on the host this deploys to.
 *
 * This route is only ever requested by `components/Img.tsx` after a media src
 * has already failed, so the healthy path pays nothing for it: no extra
 * request, no database lookup, no proxying of image bytes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params
  const payload = await getPayload()
  const found = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
  })

  const sourcePath = found.docs[0]?.sourcePath
  // A `sourcePath` is required on the collection, so a row without a usable one
  // means a media doc created outside the seed (an editor's upload). Those have
  // no bundled copy to fall back to, and a redirect to "/" would answer an
  // image request with a page — 404 is the honest answer.
  // `//host/path` is a protocol-relative URL, and a leading backslash
  // (`/\host/path`) is treated as a path separator by `URL` too — both would
  // resolve to a different origin, turning a fallback into an open redirect.
  // Rejected rather than sanitised — a seeded path never looks like that. The
  // origin check below is belt-and-braces for any other WHATWG-URL quirk that
  // does the same thing.
  if (typeof sourcePath !== 'string' || !sourcePath.startsWith('/') || sourcePath.startsWith('//')) {
    return NextResponse.json({ error: `No bundled asset for "${filename}"` }, { status: 404 })
  }

  const target = new URL(sourcePath, _request.url)
  if (target.origin !== new URL(_request.url).origin) {
    return NextResponse.json({ error: `No bundled asset for "${filename}"` }, { status: 404 })
  }

  const redirect = NextResponse.redirect(target, 302)
  // One database lookup per filename per browser session instead of one per
  // image request during an outage — short enough that restoring storage
  // un-sticks the page without a hard reload.
  redirect.headers.set('Cache-Control', 'public, max-age=60')
  return redirect
}
