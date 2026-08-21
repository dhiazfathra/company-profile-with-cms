# ADR-0008: Gate design fidelity on an automated render-versus-reference check

## Status

Accepted

## Date

2026-08-21

## Context

Phase 1 shipped a homepage whose hero rendered a green band nested inside another
green band, with the laptop mockup letterboxed and clipped. The cause is recorded
in ADR-0007: the capture pipeline was told the wrong node size, and cropped the
background band instead of the hero image.

The point of this ADR is not that bug. It is that every gate in the repository was
green while it shipped, and each of those gates was checking something real:

- `bun run validate:manifest` validates the content schema. It says nothing about
  pixels.
- `tests/sections.test.tsx` asserts that no copy is inlined in a component and
  that every collection is read exactly once. Nothing about geometry.
- `bun run build` succeeds regardless of what an image file contains.
- The Playwright e2e suite already screenshotted the homepage at three viewports
  — and asserted only HTTP 200 and the absence of console errors. The screenshots
  were uploaded as CI artifacts and compared to nothing. A green band inside a
  green band is a perfectly valid 200 with no console errors.
- The development process reviewed diffs and reports. It never reviewed a render.

ADR-0003 accepted that visual review against `apps/web/design/refs/` would be human
judgement rather than an automated diff. That was the assumption this failure
falsified: the human judgement step existed in principle and did not run.

## Decision

Compare each rendered section against its Figma reference on two axes, and fail
the build when either drifts. The comparison lives once in
`packages/figma-to-site/src/design-check.mjs` and is driven from two places: `bun run verify:design`
(`figma-verify-design`, for local iteration against a running dev server)
and `apps/web/e2e/design-fidelity.spec.ts`, which generates **one Playwright test per
section** so CI names the section that drifted and attaches the render beside the
reference.

**Axis 1 — aspect ratio**, against the size recorded in `apps/web/design/refs/refs.json`,
5% default tolerance. Geometry errors — doubled padding, a duplicated background,
an image at the wrong crop, a container at the wrong max-width — change a
section's shape long before they change its average colour. Crucially this
compares against a *number read off the design*, not against a screenshot, so a
bad screenshot cannot make it lie. This is the axis that catches the whole class
of bug ADR-0007 describes.

**Axis 2 — coarse block colour**, against the reference PNG. Both images are
reduced to a 48-cell-wide grid of mean colours and compared cell by cell, default
limit 34 on a 0–255 mean-absolute-difference scale. At that resolution font
hinting, antialiasing and image resampling wash out, while a wrong background, a
missing element or a transposed layout survives. It caught `ShowcaseImage`, whose
section carried 96px of vertical padding where the design has 20px: score 42.1,
then 23.8 once the padding was corrected.

**Axis 3 — no viewer chrome**, over every committed image rather than per section:
`apps/web/tests/assets.test.ts` scans `public/img`, `public/icons` and `design/refs` for
selection-coloured blobs thicker than an outline stroke. This exists because axis 2
provably cannot see the thing it catches. A 237x34 Figma dimension badge shipped
along the bottom edge of `public/img/showcase.png` and the section still scored 1.7
against a limit of 34 — a coarse block average is blind to small high-contrast
intrusions, and tightening its tolerance to catch them would make it fail on font
rendering instead. A badge is also a *diagnostic*: Figma prints the node's real
size inside it, so its presence means the crop reached past its target and the
declared size is wrong. In that instance the badge read "1200 Fill x 664.29 Fill"
and disproved the change that had produced it.

`apps/web/design/refs/refs.json` carries the provenance that makes this honest: each
section's design size, where that size came from (`reference` = trust the
screenshot's shape; `figma-badge` = Figma printed the number itself, which
outranks the screenshot), and whether the reference PNG is trustworthy enough to
compare content against at all. Every exemption and every loosened tolerance
carries its reason in prose, in the file.

Sections are located in the DOM by a stable `data-section` attribute, and
`screenshotSection` throws unless exactly one element matches — a renamed or
duplicated section must not read as "nothing to check".

## Alternatives Considered

### Pixel-diff snapshots

- Pros: strictest possible signal; catches everything
- Cons: the reference is a Figma canvas raster and the render is a live browser
  with different text rendering and image resampling. At any threshold loose
  enough to stop failing on noise, it no longer catches a real defect
- Rejected: no threshold exists where it is both quiet and useful

### Playwright's own `toHaveScreenshot` with committed baselines

- Pros: built in, zero new code, familiar workflow
- Cons: baselines are snapshots of *the build*, not of the design. It would have
  happily locked in the green-band-inside-a-green-band render as correct and
  guarded it thereafter
- Rejected: it protects against regression, not against being wrong in the first
  place — which is the failure that actually happened

### A hosted visual-regression service

- Pros: mature diffing, review UI, per-branch history
- Cons: an external account and a CI secret for a single-page Phase 1; still
  baseline-versus-baseline, so it inherits the objection above
- Rejected: cost and dependency out of proportion to the problem

### Human review of the captured screenshots

- Pros: catches things no metric can, including the ones listed below
- Cons: it is what ADR-0003 already specified, and it did not happen. An
  unenforced step is not a gate
- Rejected as the *only* mechanism; retained as a complement

## Consequences

All 11 sections pass, and `bun run e2e` is 23/23 with design fidelity enforced
per section. Turning the check on immediately surfaced defects that had all
already shipped:

- The page container was `max-w-[1500px]` (and again inside `Navigation`) where
  the design is 1200 wide. The 1500 came from `TOKEN-GAPS.md` recording a
  `max-width: 1500px` CSS *property* on the nav's inner container, which was
  mistaken for the design's rendered width.
- `Navigation` top padding 40px against the design's 20px.
- `Benefits`: the photo rendered at its natural aspect instead of the design's
  16:9 crop, and the margins above the card grid and the photo were too small —
  the section came out 173px short.
- `Specifications`: table cell padding too small, 988px tall against 1164.
- `HowItWorks`: section padding too small, 572 against 635.
- `CenteredCta`: built blind from the copy alone because its reference did not yet
  exist — the file even carried a comment saying so. Vertical rhythm wrong, and
  the CTA button should stretch to the full width of the text column rather than
  hug its label.
- `ShowcaseImage`: 96px of vertical padding where the design has 20px, and no
  horizontal padding — the image is full width, with white above and below.
- `Header`'s headline wrapped to two lines. `--font-display` resolves to Crimson
  Text, which advances 1132px for "Browse everything." at 160px where the design's
  face occupies 1068px; compensated with a measurement-derived
  `lg:tracking-[-8px]` and recorded as a substitution.
- A React hydration warning traced to a browser extension injecting
  `data-google-analytics-opt-out` onto `<html>`, fixed with
  `suppressHydrationWarning`.

What this gate still does not cover, stated plainly so nobody mistakes a green run
for fidelity:

A coarse block score is weak evidence on a section that is mostly background —
`LogoCloud` and `Footer` are the two here, and `refs.json` says so on the entries
it applies to. Relatedly, the block check is too coarse to see that the design
puts the copyright at the left and "All Rights Reserved" at the right while the
build renders them as one field; that is a deliberate earlier localisation
decision (ADR-0005), and a pass on `Footer` is not agreement about it.

The design's display typeface has not been identified from a raster, so the
`Header` tracking is a compensation with a measured basis, not a design value.
References are canvas rasters captured from a free-tier viewer rather than asset
exports (ADR-0007): softer, and vector icons arrive rasterised. And only Chromium
at one viewport width is checked — nothing compares responsive breakpoints against
the design's mobile and tablet frames.
