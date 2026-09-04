# ADR-0022: Images are re-encoded in place rather than migrated to WebP

## Status

Accepted

## Date

2026-09-04

## Context

The homepage shipped 20.98MB of PNG. Five files account for all of it:

| File                               | Size   | Dimensions |
| ---------------------------------- | ------ | ---------- |
| `public/img/showcase.png`          | 8.01MB | 2394×1322  |
| `public/img/benefits.png`          | 7.50MB | 2394×1234  |
| `public/img/header.png`            | 2.47MB | 1808×1002  |
| `public/img/testimonial.png`       | 1.87MB | 1175×1333  |
| `public/img/features-carousel.png` | 1.13MB | 1174×1416  |

A typical content page's whole weight budget is around 1.5MB. `header.png` is
the LCP element on every viewport and was 2.47MB on its own — the largest single
thing standing between a visitor and a rendered hero.

The dimensions are not the problem. The layout is capped at 1200px and these
are the 2× assets for it, which is correct. The encoding is the problem: these
are Figma exports, and an exporter writes 24-bit truecolour whether or not the
image needs it. They are flat UI renders — large areas of identical colour, a
few hundred distinct values — so truecolour is paying for a colour depth the
images do not use.

Separately, every media response was uncacheable. Each of the page's images was
re-proxied from Blob storage on every navigation, so a repeat visitor paid the
full transfer again.

And `components/Img.tsx` had no loading hints at all, so the browser treated the
2.47MB above-fold hero and the 8.01MB image nine sections below it as equally
urgent.

## Decision

1. **Re-encode every PNG in `public/` as a palette PNG, in place**, via
   `bun run --cwd apps/web optimize:images` — a committed, idempotent script
   with a `--check` mode for CI. 20.98MB → 6.05MB, a 71% reduction, with no
   filename, no path and no reference anywhere else in the repository changing.
2. **Default `Img` to `loading="lazy"` and `decoding="async"`**, and let the
   one above-fold image (`Header`) override with `loading="eager"`,
   `fetchPriority="high"` and `decoding="sync"`.
3. **Give `/api/media/file/*` `max-age=3600, stale-while-revalidate=86400`**,
   and hashed build output under `/_next/static/*` the `immutable` year.

## Alternatives Considered

### Convert to WebP or AVIF

- Pros: substantially smaller again than palette PNG — likely another 40–60%.
- Cons: the filename is this asset's identity in three places at once. It is the
  value in `content/globals/*.json`, it is the `sourcePath` written onto every
  media row by the seed, and it is the `public/` path the bundled fallback
  redirects to when Blob storage is unreachable (ADR-0020). Changing the
  extension means changing all three together, plus the design baselines, plus a
  migration for any database already seeded.
- Deferred, not rejected. It is the right end state and it is a change with a
  migration, which is not something to smuggle in as a side effect of an
  optimisation pass. Re-encoding keeps every path byte-identical, so it lands
  the bulk of the win today at zero coupling.

### Use the Next.js image optimizer (`next/image`)

- Pros: does format negotiation, resizing and caching per request, and would
  subsume the decision above.
- Cons: it requires the `next/image` component, and `components/Img.tsx` is a
  plain `<img>` on purpose — it rewrites `src` to a bundled fallback when CMS
  storage fails, which `next/image` does not permit. Adopting it means giving up
  the control ADR-0020 exists to provide, after a four-day outage that control
  was written for.
- Rejected for now. That trade belongs to ADR-0020 to revisit, with the
  fallback's replacement designed first.

### Downscale the assets

- Pros: the largest single lever available.
- Cons: 2394px is the correct 2× width for a 1200px container. Halving it makes
  the site visibly soft on every retina display, and the design-fidelity gate
  would be right to fail it.
- Rejected: the images are the right size and the wrong encoding.

### Cache the HTML at the edge (`s-maxage`)

- Pros: the page is `force-dynamic` and issues eleven Payload reads per request.
  Edge-caching the document would be the largest TTFB win on the table.
- Cons: an editor's save would not appear until the window expired, and
  `e2e/cms-round-trip.spec.ts` proves the opposite property — that an admin edit
  reaches the public page. A cache window and that test cannot both be right.
- Rejected: freshness is the product here. The eleven reads are the next thing
  to look at, and the answer is a shorter read path, not a staler page.

## Consequences

- Total image weight on the homepage drops from 20.98MB to 6.05MB. The LCP
  candidate `header.png` goes from 2.47MB to 0.65MB — a 74% cut on the resource
  that decides the metric.
- **The design-fidelity gate passes unchanged, all eleven sections.** That is
  the evidence that the quantization is visually lossless at the threshold this
  project already trusts; it is not an assertion about PNG in the abstract.
- `optimize:images` is idempotent, so re-running it produces no diff and
  `check:images` can be a CI step without becoming a source of churn. It has a
  100KB floor, below which quantization noise costs more than the bytes save.
- The script's test drives a temporary fixture rather than `public/`, and checks
  that the output still decodes at its original dimensions — a size assertion on
  its own would pass for a script that truncated the file.
- **Making lazy the default broke the design-fidelity gate**, and the fix is in
  `packages/figma-to-site/src/design-check.mjs` rather than in the site.
  `img.decode()` on a below-the-fold `loading="lazy"` image never settles, so all
  eleven checks timed out and reported a design regression that did not exist.
  `awaitImages` now flips every image to eager before awaiting any of them. This
  is the checker's job — put the page in a fully-rendered state before measuring
  it — and it is worth naming, because the failure mode was a _correct_
  performance change being reported as a _visual_ one.
- Media is cached for an hour, so an image replaced in the admin can take up to
  an hour to appear for a visitor who has already loaded the page. Deliberately
  not `immutable`: Payload's filename is not a content hash, so a replaced image
  can reuse a name and an immutable response would pin the old bytes.

## Supersedes

Nothing. ADR-0020's fallback is untouched and is the reason the WebP migration
is deferred rather than done: the bundled `public/` copy and the CMS filename
have to keep pointing at the same asset.
