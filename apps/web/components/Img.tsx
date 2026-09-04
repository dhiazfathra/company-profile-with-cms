'use client'

import { useEffect, useRef, useState } from 'react'

const MEDIA_PREFIX = '/api/media/file/'
const FALLBACK_PREFIX = '/api/media-fallback/'

/**
 * An `<img>` that falls back to the bundled `public/` copy of a CMS asset when
 * the CMS's own storage cannot serve it.
 *
 * Every media src on this site points at `/api/media/file/<filename>`, which
 * proxies Vercel Blob. When that store went unreachable on 2026-08-30 the page
 * rendered eleven correct sections full of broken images for four days
 * (docs/incidents/2026-09-03-media-blob-store-suspended.md). The seeded bytes
 * were on the same domain the whole time, under the `public/` path the seed
 * uploaded them from, so one fallback closes that gap.
 *
 * The fallback fires only on failure, which is the point: preferring the
 * bundled copy up front would silently serve a stale image after an editor
 * replaces one in the CMS — a quiet wrong image is worse than a visibly broken
 * one. See ADR-0020.
 */
// `alt` is required rather than optional as on a plain <img>: a decorative
// image passes alt="" explicitly, and the one thing this component must not do
// is make it easier to ship an image with no alternative text than with one.
export function Img({ src, alt, ...rest }: React.ComponentProps<'img'> & { alt: string }) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  // Only CMS-served media has a bundled counterpart to fall back to; a static
  // asset like /icons/arrow-linkout.svg is already the fallback.
  const filename =
    typeof src === 'string' && src.startsWith(MEDIA_PREFIX)
      ? src.slice(MEDIA_PREFIX.length)
      : undefined

  // These sections are server-rendered, so the browser starts fetching every
  // image from the HTML long before React hydrates — during a real outage the
  // load has already failed by then, the error event fired with no listener
  // attached, and `onError` alone would never run. That is not a hypothetical:
  // it is what e2e/media-fallback.spec.ts caught, with every image on the page
  // still broken.
  //
  // So on mount, an image that has finished loading with no intrinsic width is
  // *asked again* rather than declared failed. Reassigning `src` restarts the
  // load with the listener now attached, so a real failure reaches `onError`
  // and a success stays put. Declaring it failed here instead would be wrong
  // for a dimensionless SVG — one with no width/height attribute reports
  // `naturalWidth === 0` after loading perfectly well, and an editor can upload
  // one at any time. The repeat load is served from cache when the file is
  // fine.
  useEffect(() => {
    const image = ref.current
    if (!filename || !image) return
    if (image.complete && image.naturalWidth === 0) image.src = image.src
  }, [filename])

  return (
    <img
      // Defaults, not overrides: every image below the fold should stay off the
      // critical path, and decoding off the main thread keeps a large hero from
      // blocking paint. The one above-fold image (Header) passes
      // loading="eager" fetchPriority="high" and wins, because {...rest} spreads
      // after these.
      loading="lazy"
      decoding="async"
      {...rest}
      ref={ref}
      alt={alt}
      src={failed && filename ? `${FALLBACK_PREFIX}${encodeURIComponent(filename)}` : src}
      // Still needed alongside the mount check, for a failure that happens
      // after hydration. `failed` latches, so a fallback that also fails does
      // not swap back to the original and loop between two broken srcs.
      onError={filename && !failed ? () => setFailed(true) : undefined}
    />
  )
}
