# figma-to-site

Capture a Figma design by screenshot — no paid seat, no MCP quota — and prove the
rendered site matches it.

**[SKILL.md](./SKILL.md) is the substance of this package.** It carries the
workflow, the reasoning, and the failures each guardrail was built from. Read it
before wiring these functions into a project: several are safe only in the
arrangement it describes.

## Why this exists

A homepage shipped with its hero rendered as a green band nested inside another
green band. A human noticed by looking at the page; every automated check was
green. The crop that produced the asset locates a Figma node by the size the
caller _declares_ for it, so a wrong declared size does not fail — it returns a
different region of canvas and ships it.

This package is the pipeline plus the three checks that would have caught it.

## Quick start

```bash
# 1. Describe what to capture (see bin/capture-figma.mjs for the config shape)
$EDITOR design/figma.targets.json

# 2. Capture. Opens a real Chrome window — Figma's CDN 403s headless Chromium.
figma-capture                      # all targets
figma-capture Header Footer        # named targets only
figma-capture --crop-only          # re-crop what is on disk, no network

# 3. Check the running site against the references
figma-verify-design                # one line per section, exit 1 on drift

# 4. Check any tree of images for Figma's interface
figma-check-assets public/img public/icons design/refs
```

## Commands

| Command                                                    | Description                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `figma-capture [--config <path>] [--crop-only] [name ...]` | Capture Figma nodes as PNGs from a config file                                                         |
| `figma-verify-design [Section ...]`                        | Compare a running site against its design references                                                   |
| `figma-check-assets <dir> [dir ...]`                       | Fail if any image contains selection outlines, dimension badges or panels                              |
| `bun run test`                                             | The guardrails' own tests — each failure mode reproduced — plus the eval suite's structure             |
| `claude plugin eval .`                                     | The [skill evals](./evals/README.md): does an agent _reading_ SKILL.md judge correctly? (early access) |

`figma-verify-design` reads `BASE_URL` (default `http://localhost:3000`),
`VIEWPORT_WIDTH` (1500), `REFS_DIR` (`design/refs`) and `VERIFY_OUT`
(`design/verify`).

## API

```js
import {
  // capture
  captureAll,
  captureTarget,
  recrop,
  validateConfig,
  // cropping and chrome
  findSelection,
  cropToSelection,
  cropRelative,
  healOutlines,
  findViewerChrome,
  assertNoViewerChrome,
  scanAssets,
  // fidelity
  loadManifest,
  checkSection,
  screenshotSection,
  awaitImages,
  ASPECT_TOLERANCE,
  BLOCK_TOLERANCE,
  DEFAULT_REFS_DIR,
} from 'figma-to-site'
```

Subpath exports (`figma-to-site/design-check`, `/figma-crop`, `/capture`) avoid
pulling the whole surface into a Playwright spec.

## Architecture

Three layers, deliberately separated:

- **`src/figma-crop.mjs`** — pixel work: locate Figma's selection outline by
  8-connected components over selection-coloured pixels, crop to it, repaint
  strokes drawn over the design, and detect chrome too large to be a stroke.
- **`src/capture.mjs`** — the viewer session: one page, one node at a time, with
  the chrome assertion on the single path every crop returns through.
- **`src/design-check.mjs`** — the two-axis comparison (aspect against a number
  read off the design; coarse block colour against a vouched-for reference PNG),
  shared unchanged between the CLI and a project's e2e suite.

Per-project data — node ids, declared sizes, output paths, reference trust — lives
in the consuming project's config and trust manifest, never in this package. The
declared sizes are the most dangerous data in the pipeline; they belong somewhere a
reviewer will read them against the design.

## Two kinds of test, because two kinds of thing can be wrong

`tests/` covers the code. Every guardrail is exercised against the artefact that
shipped and against its corrected twin, because a detector that has only seen
clean input is not known to detect anything.

`evals/` covers [the skill](./SKILL.md). Every guardrail in `src/` exists because a
_judgement_ went wrong first — a size was believed because a crop succeeded, a
badge was treated as a blemish rather than as evidence, a tolerance was raised to
get a build green. Those are decisions, not functions, and no unit test can fail on
them. The ten cases put those decisions back to an agent, one of them against the
real Figma file this repository was built from. See
[`evals/README.md`](./evals/README.md), including what they cannot see.

`claude plugin eval` is in early access, so `tests/evals.test.mjs` checks the
suite's structure in CI on every push — same rule as an empty asset scan: a check
nobody can run is not a check.

Decisions behind all of this: `docs/decisions/0007` (capture by screenshot),
`0008` (the fidelity gate), `0009` (why this is a package), `0010` (why the skill
gets evals of its own, and why CI checks the suite rather than running it).
