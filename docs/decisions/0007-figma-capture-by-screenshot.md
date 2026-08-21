# ADR-0007: Capture Figma assets by cropping viewer screenshots, not by MCP asset calls

## Status
Accepted

## Date
2026-08-21

## Context
Phase 1 needs the design's images, icons and per-section reference renders on
disk (see ADR-0003, which makes reference screenshots the visual target for each
rebuilt section). The obvious source is the Figma MCP server.

Two constraints rule that out. `download_assets` and `get_screenshot` are gated
behind a paid seat, and this account's Starter quota ran out partway through the
extraction — so the tool that was working stopped working mid-job, with some
assets present and some not. A pipeline that can exhaust itself halfway is not a
pipeline; the next person to re-run it gets a different result than the last.

The file is publicly viewable, which means anything the Figma web viewer paints
is reachable with a browser and no seat.

## Decision
Capture assets by driving the public Figma web viewer with Playwright and
cropping the result. `scripts/capture-figma.mjs` loads
`figma.com/design/<key>/...?node-id=<node>` for each entry in its `TARGETS`
table; the viewer selects that node and strokes a 1–2px outline exactly on its
bounds. `scripts/figma-crop.mjs` finds that outline by connected components over
selection-coloured pixels — ancestor frames get a *dashed* outline in the same
colour, which falls apart into many small blobs while the selection outline stays
one blob — and crops inside it.

Two extra capabilities exist because the plain crop is not always enough:

- `cropRelative` describes the wanted rectangle as a design-px offset from an
  unambiguous sibling's outline, for pixels that cannot be selected on their own.
  The header laptop is such a case: it is clipped by its parent frame, so no node
  id selects the pixels wanted.
- `healOutlines` repaints selection strokes that Figma draws *over* the node —
  a purple component-instance outline ran straight through the laptop. Those
  pixels are viewer chrome, not design, and must not ship into `public/`.

Figma's CDN returns 403 to headless Chromium, so the script launches a real
Chrome channel with `headless: false`. Raw canvas captures are kept in
`design/captures/` so `--crop-only` can re-crop without touching the network.

## Alternatives Considered

### Buy a paid Figma seat and use the MCP asset tools
- Pros: sharper output; real asset exports; vector icons stay vectors
- Cons: a purchase decision that is not this project's to make, and it does not
  remove the quota model — it raises the ceiling
- Rejected: not available at the time the work had to happen

### Figma REST API with a personal access token
- Pros: scriptable, no browser, returns real exports
- Cons: image export endpoints are also plan-gated, and it introduces a secret
  that every contributor and CI job then needs
- Rejected: same gate, plus credential handling

### Hand-exported assets committed by a designer
- Pros: highest fidelity, zero tooling
- Cons: a human step in the middle of the loop; re-capturing one asset after a
  design change becomes an ask rather than a command
- Rejected: not reproducible from the repository

### Continue on the MCP quota, capturing what fits
- Pros: no new code
- Cons: the failure mode already happened — a half-finished extraction with no
  signal about which half
- Rejected: the method must not be able to run out

## Consequences
The pipeline is reproducible and free, and it is the reason ADR-0008 exists.

The crop has to be *told* each node's size, and that is its sharp edge.
`findSelection` scores candidate outline blobs by how close they are to the width
and height the caller declares in `TARGETS`, then takes the best match. It cannot
distinguish "this node is 1200x362" from "some node near here is 1200x362", and
it never fails — a wrong declared size returns a confident, plausible, wrong
rectangle. Two targets named the wrong pixels and both shipped:

- `Header` (node `1-122`) declared 1200x362. That size was correct for the node,
  but the node is the flat green background band, not the hero image. The band
  shipped as `public/img/header.png`, and `components/sections/Header.tsx` then
  placed it inside a second green band of its own — a green band nested in a green
  band, with the laptop letterboxed and clipped. A human noticed by looking at the
  page.
- `Footer` (node `1-257`) declared 1200x519; the node is 1200x250. Nothing
  matched, so the matcher settled on a nearby blob and wrote out a strip
  containing Figma's own selection size badge (legibly reading
  "1200 Fill x 250 Hug"), the dark canvas behind the frame, and a cookie banner —
  shipped as `design/refs/Footer.png`, a *design reference*. A corrupt reference
  is worse than a missing one: it cannot fail a bad build and it cannot pass a
  good one.
- `Showcase` (node `1-252`) was *wrongly believed* to be a third bad capture.
  Its declared 1200x664 was correct; the section around it carried 96px of
  vertical padding where the design has 20px, and the fix belonged in the
  component. Acting on the wrong theory — that the 1200x704 section reference
  *was* this node, because at thumbnail size the image appears to fill that frame
  corner to corner — widened the declared height to 704. The crop then reached
  past the node and shipped Figma's dimension badge into `public/img/showcase.png`,
  where it legibly read "1200 Fill x 664.29 Fill" and disproved the theory that
  had produced it. Corrected back to 664.29, with the padding fixed instead.

So the declared size in `TARGETS` is load-bearing and must be verified against
something other than the crop's own success. That is precisely what ADR-0008
adds. The corrected `Header` target, using `cropRelative` plus `healOutlines`,
now reproduces the hand-made asset byte for byte.

Everything captured this way is a canvas render at one zoom level, not an asset
export: softer than a real export, and vector icons arrive rasterised. That
limitation is recorded per reference in `design/refs/refs.json` rather than
assumed away.

The capture run is visible on screen while it works, because it needs a real
Chrome window. It is a local developer command, not a CI step.
