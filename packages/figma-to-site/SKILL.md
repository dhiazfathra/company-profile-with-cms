---
name: figma-to-site
description: Build a site from a Figma design without a paid seat, and prove the render matches. Use when implementing a Figma file as code, capturing Figma assets or reference screenshots, hitting Figma MCP quota or paid-seat limits, or setting up a design-fidelity gate so layout drift fails the build instead of shipping.
---

# Figma to Site

## Overview

Two things go wrong when a design becomes code, and both ship silently:

1. The assets you cropped out of Figma are not the pixels you thought they were.
2. Nothing in the build ever looks at what the browser paints.

This skill is the workflow that closes both. Its central rule:

> **Verify the render, not the diff.** A green test suite is evidence that the
> code does what the code does. It is not evidence that the page looks like the
> design. Nothing is verified until something compares a browser render against a
> number or an image taken from the design.

The runnable implementation ships beside this file, in the same package:

| Path | What it is |
|---|---|
| `src/figma-crop.mjs` | Selection-outline detection, cropping, stroke healing, chrome detection |
| `src/capture.mjs` | Drives the Figma web viewer and captures each target |
| `src/design-check.mjs` | The two-axis comparison, plus the trust-manifest loader |
| `src/scan-assets.mjs` | The chrome detector applied to committed images |
| `bin/capture-figma.mjs` | `figma-capture` — capture from a project's config file |
| `bin/verify-design.mjs` | `figma-verify-design` — check a running site, one line per section |
| `bin/check-assets.mjs` | `figma-check-assets` — fail if any committed image carries Figma UI |
| `tests/` | The guardrails' own tests, each failure mode reproduced |

A worked consumer lives at `apps/web` in this repository:
`design/figma.targets.json`, `design/refs/refs.json`,
`e2e/design-fidelity.spec.ts`, `tests/assets.test.ts` — plus ADR-0007
(capture by screenshot), ADR-0008 (the fidelity gate) and ADR-0009 (why this is
a package and not a folder of scripts) under `docs/decisions/`.

## The motivating failure — read this before anything else

A homepage shipped with its hero rendered as a green band nested inside another
green band, the laptop mockup letterboxed and clipped. A human noticed by looking
at the page. Every automated check was green.

Assets had been captured by driving the public Figma viewer with Playwright and
cropping to the selection outline Figma strokes around the node named in
`?node-id=`. The crop function scored candidate outline blobs by how close they
were to a width and height **the caller declared** in a targets table, and took
the best match. It cannot distinguish "this node is 1200x362" from "some node near
here is 1200x362". Two declared sizes were wrong, and both shipped:

- Declared 1200x362 for the hero. Correct size — for the *flat green background
  band*, not the hero image. The band shipped as the hero asset, and the component
  then placed it inside a second green band of its own. That is the visible bug.
- Declared 1200x519 for the footer; the node is 1200x250. Nothing matched, so the
  matcher settled on a nearby blob and wrote out a strip containing Figma's own
  selection size badge (legibly reading "1200 Fill x 250 Hug"), the dark canvas
  behind the frame, and a cookie banner — shipped as a *design reference*.

**The lesson.** A size-matching crop is a guess that always succeeds. It has no
failure mode: given a wrong size it returns a confident, plausible, wrong
rectangle. Never let a declared node size be the only thing standing between you
and a shipped asset.

**And the follow-on lesson, which cost a second round.** A third section — a
full-width showcase image — scored far outside tolerance and was misdiagnosed as a
third bad capture. Its declared 1200x664 was *correct*; the section around it
carried 96px of vertical padding where the design has 20px, and the fix belonged
in the component. But the section reference measured 1200x704, the image inside it
appeared at thumbnail size to fill that frame corner to corner, so the declared
node height was "corrected" from 664 to 704 and the padding removed. Both numbers
then agreed and the section passed — while the wider crop had reached past the node
and shipped Figma's dimension badge into `public/`, where the badge legibly read
"1200 Fill x 664.29 Fill". The original number had been right all along, and the
first diagnosis — a padding problem — had been right too.

Three rules come out of that:

- **Do not infer a node's size from how a downscaled reference looks.** 20px of
  white above an image is invisible in a thumbnail. Read the size off a badge or a
  frame.
- **When a section is the wrong *shape*, suspect the component before the asset.**
  Geometry is far more often a padding mistake than a bad crop.
- **A fix that makes two numbers agree is not thereby correct.** Both were moved
  to meet each other. Ask what independent evidence says either is right.

And note what the second failure means for references specifically. A corrupt
reference is worse than a missing one. A missing reference is a known gap. A
corrupt reference cannot fail a bad build and cannot pass a good one — it silently
converts your entire fidelity gate into theatre.

## Step 1 — Establish the design's canonical width from evidence

Before building anything, decide what the design's rendered width is and write it
down once, as `designWidth` in the trust manifest. Every later check is relative
to it.

Get it from a frame's own dimensions or from a size badge Figma printed next to a
selected node. **Do not** take it from a CSS `max-width` property you read off an
inspector panel. In the failure above, a recorded `max-width: 1500px` on a nav's
inner container was mistaken for the design's rendered width, and a 1500px page
container shipped against a 1200px design. The evidence that settled it was a
section scoring 1.7 on block difference at 1200 and far worse at 1500 — a
measurement, not a property.

## Step 2 — Capture by screenshot, not by rate-limited MCP calls

Figma MCP `download_assets` / `get_screenshot` are paid-seat gated and quota'd. A
quota'd method can stop working halfway through a job, leaving some assets present
and some not, with no signal about which. If the file is publicly viewable, drive
the real viewer instead — it never runs out. (ADR-0007 records the alternatives.)

`captureAll` in `src/capture.mjs` does all of this; the mechanics are here so you
can port or debug it:

1. Launch Playwright with a **real Chrome channel and `headless: false`**. Figma's
   CDN returns 403 to headless Chromium. This is why capture is a local developer
   command and not a CI step.
2. `goto("https://www.figma.com/design/<key>/<name>?node-id=<node>")`. The viewer
   selects that node.
3. Wait on a timer, not an event — the viewer streams geometry and images in after
   load with no ready signal. Dismiss the cookie banner.
4. Screenshot the `canvas` element. Keep the raw capture on disk so you can
   re-crop without hitting the network again (`--crop-only`).
5. Find the selection outline: Figma strokes 1–2px on the selected node's bounds,
   blue (`#0d99ff`) for a plain node, purple (`#9747ff`) for a component instance.
   Mask those colours and run 8-connected components. **Do not** take min/max over
   coloured pixels — ancestor frames get a *dashed* outline in the same colour,
   which shatters into many tiny blobs while the selection outline stays one blob
   whose bounding box is the node's bounds.
6. Crop *inside* the outline (inset a few px) so no selection colour survives.
7. At 100% zoom with `deviceScaleFactor: 2`, the outline is exactly 2x the node.
   For tiny nodes (icons), zoom the canvas first — Ctrl + mouse wheel is the only
   zoom that reaches the canvas; keyboard shortcuts do not — then match by aspect
   ratio instead of absolute size.

Keep the project's node ids, sizes and output paths in a **config file**, not in
the shared code (`design/figma.targets.json`; see `bin/capture-figma.mjs` for the
shape). A targets table hardcoded inside a shared module is a table nobody reviews
against the design it describes — and the declared sizes in it are the single most
dangerous data in this pipeline. Give every number with a story a `note` field
holding that story, next to the number.

### Strip viewer chrome — and assert it is gone

Selection outlines, dimension badges, panel edges and cookie banners are not
design. Specific traps:

- The dimension badge sits just below the outline and can fuse onto it, stretching
  the bounding box downward. Correct the height using the node's own aspect ratio
  (`cropToSelection` does).
- Figma strokes outlines *over* the node too — a purple component-instance outline
  ran straight through a laptop mockup. Insetting the crop only escapes the stroke
  on the node's own bounds.

**Repair thin strokes; fail on everything else.** These need opposite treatment
and conflating them is how chrome ships:

- A stroke crossing a crop is 1–2 device px in one direction however long it runs.
  Detect selection-coloured pixels, grow the mask ~2px to catch the antialiased
  fringe, and repaint each from the nearest clean pixel above and below in its own
  column (`healOutlines`).
- A badge is a *filled* rounded rectangle with white text in it. Interpolating it
  away leaves a smear that still is not the design. So it must fail the capture.

The discriminator is the blob's **bounding box**: if its smaller dimension exceeds
a stroke width (~8 device px), it is chrome, not a stroke (`findViewerChrome` /
`assertNoViewerChrome`). A *closed* outline caught whole inside a crop is one blob
whose box is the node's entire bounds, so it reports as chrome — which is right: a
crop containing a complete selection rectangle reached past its node.

Put the assertion on the single code path every crop returns through, so no target
can opt out of it. A check a caller can forget is a check that will be forgotten.

**A badge is a symptom, not the disease.** Figma prints the node's real size
inside it. If a badge appears in your crop, the crop reached past the node it was
aiming at — which means the size you declared for that node is wrong. Read the
number off the badge and correct the target. Make your error message say this;
`assertNoViewerChrome`'s does, and a test asserts that it does.

This trap is subtle enough that it survived a *passing* fidelity check: a 237×34
badge on a 2394×1400 image moved the block score to 1.7, comfortably inside a
tolerance of 34. Coarse comparison cannot see small high-contrast intrusions. That
is not a reason to tighten the block tolerance — every honest section would fail
first — it is the reason chrome needs its own dedicated, size-based check.

### Check what is committed, not only what you capture

Run the chrome assertion as a test over every image in the repository, not just
inside the capture script. An asset can be hand-replaced, copied from elsewhere,
or produced by a script that predates the check. `scanAssets` is that scan;
`apps/web/tests/assets.test.ts` is a worked example over `public/img`,
`public/icons` and `design/refs`, and `figma-check-assets` is the same thing for a
tree you did not capture.

Make an **empty directory a failure**, not a pass. A scan with nothing to scan
reads as clean, and pointing the guardrail at a moved directory is the easiest way
for it to go green forever.

Verify such a guardrail **in both directions** before trusting it: reproduce the
bad artefact, confirm the check rejects it, then confirm it accepts the corrected
one. A detector that has only ever seen clean input is not known to detect
anything. `tests/figma-crop.test.mjs` builds its fixtures with `sharp` rather than
committing PNGs, precisely so each test states its own premise — "a 2px blue
stroke", "a 237x34 filled badge" — instead of pointing at an opaque binary whose
relevant property is invisible.

### When a node cannot be selected alone

Clipped children, or a node whose bounds coincide with a sibling's, cannot be
isolated by node id. Select a sibling whose bounds *are* unambiguous, then describe
the wanted rectangle as a design-px offset from that outline, measured off the
reference (`cropRelative`: `{ dx, dy, w, h }`, converted by `scale`). Bounds-check
the result against the capture's dimensions and **throw** if it falls outside —
clamping returns a smaller-but-plausible rectangle, which is the exact failure
mode this whole pipeline exists to prevent.

## Step 3 — Record reference provenance and trust as first-class data

Keep a manifest beside the reference PNGs (`design/refs/refs.json`;
`loadManifest` reads and validates it):

```json
{
  "designWidth": 1200,
  "sections": {
    "Header": { "size": [1200, 738], "sizeFrom": "reference", "blockCheck": true },
    "Footer": {
      "size": [1200, 250],
      "sizeFrom": "figma-badge",
      "blockCheck": true,
      "blockTolerance": 42,
      "blockToleranceReason": "why, in prose"
    }
  }
}
```

Rules:

- `size` is in design px and is the **authority** for the aspect check.
- `sizeFrom` records where it came from, and is **required** — `loadManifest`
  throws without it. `reference` = the reference PNG's own aspect, scaled to
  `designWidth` (the screenshot is trusted for shape). `figma-badge` = Figma
  printed the number itself, which **outranks** the screenshot.
- `blockCheck` says whether this PNG is trustworthy enough to compare content
  against. A reference nobody has vouched for must not be able to pass a section,
  and must not be able to fail one either. Note the asymmetry: switching off the
  content check must never switch off the aspect check, because the aspect check
  compares against a number rather than the suspect image.
- Every `false` and every loosened tolerance carries its reason in prose, in the
  file. A tolerance without a reason is a tolerance that will keep growing.
- A low score on a section that is mostly background (a logo strip, a white
  footer) is **weak evidence**. Label it as such where it applies. Do not bank it
  as fidelity.
- If the manifest vouches for a reference PNG that is not on disk, that is a
  **failure**, not a skipped check. A manifest promising a file it does not have is
  broken, and treating it as an absent check is how a gate becomes theatre.
- Do not restate node ids in the trust manifest. The capture config is the one
  place mapping node id to output file; a second unverified copy of the thing that
  broke is not an improvement.

## Step 4 — The two-axis check

Two axes, because they fail on different things. `checkSection` is both; drive it
from a CLI and from the e2e suite so a local pass and a CI pass mean the same
thing.

**Axis 1: aspect ratio** against the number in the manifest. Default tolerance 5%.
Geometry errors — doubled padding, a duplicated background, an image at the wrong
crop, a container at the wrong max-width — change a section's shape long before
they change its average colour. Because this compares against a number read off
the design rather than against a screenshot, **a bad screenshot cannot make it
lie**. This is the axis that catches the whole class of bug above. Put the design
size and its `sizeFrom` in the failure message, so a reader can tell "the render
is wrong" from "the manifest is wrong".

**Axis 2: coarse block colour** against the reference PNG. Reduce both images to a
48-cell-wide grid of mean colours (flatten alpha onto white, `fit: fill`, cubic
kernel, rows = `round(48 / designAspect)`), then compare cell by cell as a mean
absolute difference on a 0–255 scale. Default limit ~34; set defaults from the
spread of the sections that are already correct, with headroom. At that resolution
font hinting, antialiasing and image resampling wash out, while a wrong
background, a missing element or a transposed layout survives. Compare at the
*design* aspect so a wrong shape is not punished twice — axis 1 already reported
it. This is what caught the over-cropped showcase image: score 42.1, then 1.7
after re-capture.

**Do not pixel-diff.** Between a live browser and a Figma canvas raster, a
pixel-diff is noise at every threshold that would still catch a real defect.
Equally, do not commit browser screenshot baselines (`toHaveScreenshot`) as the
fidelity gate: a baseline is a snapshot of the build, not of the design, and it
will happily lock in a wrong render as correct and guard it thereafter. ADR-0008
records both rejections.

## Step 5 — Anchor sections in the DOM and generate one test per section

- Give each section a stable `data-section="Name"` attribute. Locate by that, not
  by nth-child or heading text.
- Assert **exactly one** match and throw otherwise (`screenshotSection` does). A
  renamed or duplicated section must not read as "nothing to check".
- Wait for images to decode before screenshotting (`awaitImages`), or undecoded
  images screenshot as blank space and score well. Treat a *failed* load as a hard
  error rather than a measurement: a 404 leaves `complete === true` with
  `naturalWidth === 0`, so filtering on `!complete` skips it silently.
- Generate one test per manifest entry at collection time, so CI names the section
  that drifted rather than failing one opaque test. Load the manifest
  synchronously — Playwright compiles specs without top-level await, which is why
  `loadManifest` is sync and must stay sync.
- On failure, attach both the render and the reference to the report so the
  failure is inspectable rather than a number in a log.
- Run at a viewport at or above the design width, with `deviceScaleFactor` matching
  how the references were captured.

## Step 6 — Build each section against a reference, never blind

If no reference exists for a section, **capture one first**. If you truly cannot,
mark the component as unverified in the trust manifest and say so out loud in the
handover — do not infer layout from the copy and leave no trace. That is exactly
how one CTA section shipped with wrong vertical rhythm and a button hugging its
label instead of stretching to the text column: it was built from copy alone, and
the only record was a comment in the file nobody read.

Once the check exists, use its pass/fail as the objective function. Fixing eleven
sections is eleven independent problems, each with a number that says whether it
is solved — which parallelises cleanly, one worker per component file, shared
files off-limits.

## Step 7 — Treat font substitution as a measurable fidelity risk

You will not always have the design's typeface. The signature of a substitution is
text advancing wider (or narrower) than the design and wrapping differently — e.g.
a display face advancing 1132px for a headline the design fits in 1068px, so the
headline breaks to two lines and the section comes out 145px too tall.

When it happens: measure both advances, compensate with an explicit tracking or
size adjustment derived from that measurement, and **record it as a known gap**
naming the substituted face and the compensation. Do not quietly retune design
tokens until it looks right — that pushes the error into every other section that
uses the token. Do not guess at the typeface's identity either; an unidentified
face is a gap to write down, not a blank to fill in.

## Step 8 — Write down what the gate cannot see

The last honest step. A fidelity gate that reports only passes teaches the next
person that a pass means fidelity. Record the residual limits where they will be
read — in the trust manifest per section, and once in prose. From the reference
implementation:

- On a section that is nearly all background, a low block score is weak evidence.
- The design puts the footer copyright left and "All Rights Reserved" right; the
  build renders them as one field deliberately (a localisation decision), and the
  block check is too coarse to see the difference. A pass here is not agreement.
- References are canvas rasters from a free-tier viewer, not asset exports: softer
  than an export, and vector icons arrive rasterised.
- Only one browser at one width is checked. Nothing compares the responsive
  breakpoints against the file's mobile and tablet frames.

## Checklist

- [ ] Design's canonical rendered width established from a frame size or a Figma
      size badge — not from a CSS `max-width` property.
- [ ] Capture targets live in a project config file, each surprising number
      carrying its reason.
- [ ] Capture script drives a real Chrome channel (headless gets 403), keeps raw
      captures, and supports re-crop without network.
- [ ] Every declared node size verified against something other than the crop
      succeeding.
- [ ] Every captured asset opened and looked at. Yes, every one.
- [ ] No selection outlines, dimension badges, cookie banners or canvas
      background in any shipped asset or reference — asserted in code, on the
      path every crop returns through, and again as a test over every committed
      image, with an empty directory counting as a failure.
- [ ] Chrome detector verified in both directions: rejects the bad artefact,
      accepts the corrected one.
- [ ] Clipped or ambiguous nodes captured by sibling anchor + design-px offset,
      throwing rather than clamping when out of bounds.
- [ ] Trust manifest exists: design size, `sizeFrom`, `blockCheck`, and a prose
      reason on every exemption and loosened tolerance.
- [ ] A missing-but-vouched-for reference fails; a distrusted reference still gets
      its aspect checked.
- [ ] Every section has a reference before its component is built; unverified
      components are labelled.
- [ ] `data-section` on every section; exactly-one assertion enforced; images
      awaited, failed loads hard-erroring.
- [ ] Aspect + block check wired into both a CLI command and one e2e test per
      section; failures attach render beside reference.
- [ ] Font substitutions measured, compensated locally, and recorded as gaps.
- [ ] Residual limitations written down: mostly-blank sections, deliberate
      divergences, unidentified typefaces, raster-not-export references, single
      browser and viewport.

## Red Flags and Rationalisations

| Rationalisation | Reality |
|---|---|
| "The build is green so the design is right" | The build compiles code. It has never seen a rendered pixel. Every gate was green while a green band shipped inside a green band. |
| "The asset is what the crop returned, so it must be the node" | A size-matching crop always succeeds. Wrong size in, confident wrong rectangle out. Two of them shipped. |
| "The reference looks close enough" | Then say *how* close, as a number, in the manifest, with a reason. "Close enough" is how a strip of Figma's own UI became a design reference. |
| "I'll loosen the tolerance to get it passing" | A tolerance change is a fidelity decision. It needs a written reason in the manifest, or it is just deleting the test. |
| "No reference exists so I'll infer it from the copy" | Capture the reference, or mark the component unverified. Inferring silently is how the CTA shipped wrong. |
| "The e2e suite already screenshots the page" | Screenshots compared to nothing are artifacts, not assertions. 200 OK with no console errors is exactly what a broken layout returns. |
| "A pixel-diff would be stricter" | Stricter and useless: at any threshold quiet enough to live with, it no longer catches a real defect. |
| "I'll commit a screenshot baseline instead" | That guards the build against changing. It does not check the build against the design, and it will freeze a wrong render as canon. |
| "The block score is low, so the section matches" | On a mostly-white section a low score is weak evidence. Label it, don't bank it. |
| "The fidelity check passed, so the asset is clean" | A 237x34 Figma badge scored 1.7 out of a 34 limit. Coarse comparison cannot see small high-contrast intrusions; chrome needs its own check. |
| "There's a badge in the crop, I'll paint it out" | The badge is telling you the declared node size is wrong. Read the number off it and fix the target. Painting it out keeps the wrong rectangle. |
| "The image looks like it fills the reference frame" | At thumbnail size 20px of white is invisible. Never infer a node's size from a downscaled reference; read it off a badge or a frame size. |
| "Both numbers agree now, so it's fixed" | They were both moved to meet each other. Ask what independent evidence says either one is right. That reasoning shipped a Figma badge into `public/`. |
| "The section is the wrong shape, so the asset must be wrong" | Geometry is more often a padding mistake in the component. Suspect the cheap explanation first; re-cropping on a wrong theory makes things worse. |
| "My detector passes, so it works" | It has only seen clean input. Reproduce the bad artefact and confirm it is rejected, or you have tested nothing. |
| "The asset scan is green" | Check it scanned anything. An empty or moved directory reads as clean forever. |
| "The reference is missing, so skip that check" | A manifest that vouches for a file it does not have is broken. Fail, don't skip. |
| "The font is close, I'll just nudge the tokens" | Nudging a shared token to fix one headline moves every other section that uses it. Compensate locally, record the gap. |
| "Everything passes, so the page matches the design" | Say what the gate cannot see, or the next person will read a pass as fidelity. Mostly-blank sections, one viewport, one browser, raster references. |
