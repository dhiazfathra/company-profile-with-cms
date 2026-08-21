# company-profile-with-cms

**v0.1.0**

A monorepo with two outputs from one piece of work:

| Workspace                                          | What it is                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [`apps/web`](apps/web)                             | A Figma design built as a manifest-driven static Next.js site, on a path to a Payload CMS without copy rework      |
| [`packages/figma-to-site`](packages/figma-to-site) | The reusable method: capture a Figma file by screenshot with no paid seat, and prove the render matches the design |

The site is the instance. The package is the transferable part — and it exists
because the first attempt at the site shipped a hero section rendering a green band
nested inside another green band, while every automated check was green. Its
[SKILL.md](packages/figma-to-site/SKILL.md) is the workflow, the reasoning, and the
failure history; [ADR-0009](docs/decisions/0009-monorepo-with-figma-to-site-package.md)
records why the two are separated.

## Quick start

```bash
bun install          # links both workspaces
bun run dev          # the site at http://localhost:3000
bun run test         # both suites: the site's and the package's
```

There is no CMS admin route yet. Phase 2 (Payload) is specified but not built —
content currently lives in `apps/web/content/*.json`. See
[`apps/web/README.md`](apps/web/README.md) for the site's own detail.

## Commands

Each root command delegates to the workspace that owns it, so the names work from
either place.

| Command                     | Description                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `bun install`               | Install and link all workspaces                                                         |
| `bun run dev`               | Start the site's development server                                                     |
| `bun run build`             | Production build (static export)                                                        |
| `bun run start`             | Serve the static export from `out/`                                                     |
| `bun run test`              | Unit tests for both the site and the package, plus the eval suite's structure           |
| `bun run lint`              | Lint the site                                                                           |
| `bun run validate:manifest` | Validate `site.manifest.json` against its schema                                        |
| `bun run verify:design`     | Compare the running page against the Figma references (needs a dev server)              |
| `bun run capture:figma`     | Re-capture assets and references from Figma — opens a real Chrome window, so local only |
| `bun run e2e`               | End-to-end tests, including one design-fidelity test per section                        |
| `bun run e2e:report`        | Open the e2e HTML report with traces, videos, screenshots                               |

`capture:figma` is deliberately not a CI step: Figma's CDN returns 403 to headless
Chromium, so capture needs a visible browser. What CI runs is the _verification_ —
the design-fidelity suite and the committed-asset scan — neither of which touches
Figma.

## Architecture

```text
Figma ──capture (screenshot)──> apps/web/design/refs/*.png + apps/web/public/img/*.png
      ──extract──────────────> site.manifest.json ──> content/*.json ──> components
                                (human reviews)
                                                          │
browser render ──────two-axis check────────────────────────┘
                (aspect vs a number off the design;
                 coarse block colour vs a vouched-for reference)
```

The load-bearing idea, from `SKILL.md`: **verify the render, not the diff.** A
green test suite proves the code does what the code does. Nothing is verified until
something compares a browser render against a number or an image taken from the
design.

## Decisions

| ADR                                                                   | Decision                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [0001](docs/decisions/0001-nextjs-payload-single-repo.md)             | Next.js + Payload in a single repository                                 |
| [0002](docs/decisions/0002-manifest-driven-generation.md)             | Generate components, content, and schema from one manifest               |
| [0003](docs/decisions/0003-token-and-section-rebuild.md)              | Rebuild Figma as semantic sections, not pixel-faithful codegen           |
| [0004](docs/decisions/0004-content-json-in-cms-shape.md)              | Phase 1 content stored in the CMS's shape                                |
| [0005](docs/decisions/0005-native-localization-suffix-interchange.md) | Payload native localization; `_en` suffix as interchange format          |
| [0006](docs/decisions/0006-bun-as-package-manager.md)                 | Bun as package manager and script runner; Node.js as the runtime         |
| [0007](docs/decisions/0007-figma-capture-by-screenshot.md)            | Capture Figma assets by cropping viewer screenshots, not MCP asset calls |
| [0008](docs/decisions/0008-automated-design-fidelity-gate.md)         | Automated two-axis design-fidelity gate instead of pixel-diff snapshots  |
| [0009](docs/decisions/0009-monorepo-with-figma-to-site-package.md)    | Monorepo, with the Figma pipeline as a reusable package                  |
| [0010](docs/decisions/0010-behavioural-evals-for-the-skill.md)        | Evaluate the skill's judgement behaviourally; validate the suite in CI   |

Full design spec:
[`docs/superpowers/specs/2026-08-21-figma-to-cms-pipeline-design.md`](docs/superpowers/specs/2026-08-21-figma-to-cms-pipeline-design.md).
Design-token literals not bound to a Figma variable, and the gaps the fidelity
check cannot see: [`apps/web/TOKEN-GAPS.md`](apps/web/TOKEN-GAPS.md).
