# company-profile-with-cms

**v0.1.0**

A monorepo with three outputs from one piece of work:

| Workspace                                          | What it is                                                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [`apps/web`](apps/web)                             | A Figma design built as a manifest-driven Next.js site, now backed by Payload CMS, with no copy rework between phases |
| [`packages/figma-to-site`](packages/figma-to-site) | Step one as a reusable skill: capture a Figma file by screenshot with no paid seat, and prove the render matches      |
| [`packages/site-to-cms`](packages/site-to-cms)     | Step two: move that page's content into a CMS, and prove the page actually reads from it                              |

The site is the instance. The two skills are the transferable part, and each exists
because of a failure the site had already shipped or nearly shipped.

[`figma-to-site`](packages/figma-to-site/SKILL.md) comes from a hero section that
rendered a green band nested inside another green band while every automated check
was green. Its rule: **verify the render, not the diff.**

[`site-to-cms`](packages/site-to-cms/SKILL.md) comes from the migration that
followed. It finished with 154 tests, eleven fidelity comparisons and a clean
build — all of which would have been just as green with the CMS not connected at
all, because the seed wrote into Payload exactly the strings the components had
hardcoded. Its rule: **prove the seam, not the render.**

[ADR-0009](docs/decisions/0009-monorepo-with-figma-to-site-package.md) records why
the site and the skills are separated;
[ADR-0012](docs/decisions/0012-cms-step-as-a-second-skill.md) why the CMS step is
its own skill and ships no extracted code.

## Quick start

```bash
bun install          # links every workspace
bun run dev          # the site at http://localhost:3000
bun run test         # the site's suite and both skills' suites
```

[`docs/reproduce.md`](docs/reproduce.md) is the long version: clone to running
site to working deployment, one section per skill in the order they were run,
including which steps cannot run in CI and why.

The CMS admin route is live at `/admin` (`bun run dev`, backed by Payload).
`bun run --cwd apps/web gen:cms` generates its config from
`apps/web/site.manifest.json`; `bun run --cwd apps/web seed` loads
`apps/web/content/*.json` into it. See [`apps/web/README.md`](apps/web/README.md)
for the site's own detail.

## Commands

Each root command delegates to the workspace that owns it, so the names work from
either place.

| Command                     | Description                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `bun install`               | Install and link all workspaces                                                         |
| `bun run dev`               | Start the site's development server                                                     |
| `bun run build`             | Production build (Payload's `/admin` and API routes are server-rendered, not exported)  |
| `bun run start`             | Serve the production build (`next start`)                                               |
| `bun run test`              | Unit tests for the site and both skills, plus each eval suite's structure               |
| `bun run lint`              | Lint the site                                                                           |
| `bun run validate:manifest` | Validate `site.manifest.json` against its schema                                        |
| `bun run verify:design`     | Compare the running page against the Figma references (needs a dev server)              |
| `bun run capture:figma`     | Re-capture assets and references from Figma — opens a real Chrome window, so local only |
| `bun run e2e`               | End-to-end tests, including one design-fidelity test per section                        |
| `bun run e2e:report`        | Open the e2e HTML report (traces and videos for failures)                               |
| `bun run evidence`          | Run every gate and write the PR evidence pack to `e2e-evidence/`                        |

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

The load-bearing idea, from `figma-to-site`: **verify the render, not the diff.** A
green test suite proves the code does what the code does. Nothing is verified until
something compares a browser render against a number or an image taken from the
design.

Once the content moves into the CMS, that check stops being sufficient — a render
looks identical whether the page read its copy from the database or from a string
literal. So `site-to-cms` adds the seam:

```text
admin UI ──writes a value no fixture contains──> Payload ──> lib/content.ts ──> page
                                                                                │
                        required on the page and in the server's HTML ───────────┘
```

**Prove the seam, not the render.** `apps/web/e2e/cms-round-trip.spec.ts` is that
proof, and it is verified in the failing direction: hardcode the headline back into
the component and it must go red.

## Deploying

Three of the four deployment variables have a failure mode worth naming here
(the fourth, `DATABASE_AUTH_TOKEN`, just refuses to authenticate — see
[`apps/web/README.md`](apps/web/README.md) for the full table). Two of the
three below are traps a green build says nothing about.
`PAYLOAD_SECRET` fails the build loudly. `DATABASE_URI` left on its `file:`
default builds green and loses every editor save. `BLOB_READ_WRITE_TOKEN` is now
required in production too — without it, uploaded media goes to a filesystem the
deployment does not keep, so the media rows survive in the remote database while
the files stay on the machine that ran the seed and every image 500s behind a
green build. That one already shipped; [ADR-0014](docs/decisions/0014-media-on-blob-storage.md)
is the account. Setting the token does not repair existing rows — reseed.

Details in [`apps/web/README.md`](apps/web/README.md), the sequence in
[`packages/deploy-to-vercel/SKILL.md`](packages/deploy-to-vercel/SKILL.md).

**After deploying, check the deployment.** `bun run evidence` runs entirely on
your machine, so it cannot see a difference that only exists on the host — which
is how the media defect above shipped behind four green checks.
`bun run parity-report` asks the Figma references, the local server and the
deployment the same questions and writes `parity-report/report.html`: each
section's design reference, local render and deployed render side by side, plus
what loaded and what did not. It exits non-zero on a disagreement, and
`.github/workflows/parity.yml` runs it against a deployment URL.
[`docs/parity-gaps.md`](docs/parity-gaps.md) is the gap list it was built from —
what differed, why, and what was deferred.

Point it at the **production** URL. Preview deployments are protected, so a
preview URL answers with a login page; the report names that and declines to
grade the sections, rather than reporting every section as missing
([ADR-0015](docs/decisions/0015-a-checker-must-prove-it-checked-the-right-thing.md)).

## Decisions

| ADR                                                                            | Decision                                                                    |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| [0001](docs/decisions/0001-nextjs-payload-single-repo.md)                      | Next.js + Payload in a single repository                                    |
| [0002](docs/decisions/0002-manifest-driven-generation.md)                      | Generate components, content, and schema from one manifest                  |
| [0003](docs/decisions/0003-token-and-section-rebuild.md)                       | Rebuild Figma as semantic sections, not pixel-faithful codegen              |
| [0004](docs/decisions/0004-content-json-in-cms-shape.md)                       | Phase 1 content stored in the CMS's shape                                   |
| [0005](docs/decisions/0005-native-localization-suffix-interchange.md)          | Payload native localization; `_en` suffix as interchange format             |
| [0006](docs/decisions/0006-bun-as-package-manager.md)                          | Bun as package manager and script runner; Node.js as the runtime            |
| [0007](docs/decisions/0007-figma-capture-by-screenshot.md)                     | Capture Figma assets by cropping viewer screenshots, not MCP asset calls    |
| [0008](docs/decisions/0008-automated-design-fidelity-gate.md)                  | Automated two-axis design-fidelity gate instead of pixel-diff snapshots     |
| [0009](docs/decisions/0009-monorepo-with-figma-to-site-package.md)             | Monorepo, with the Figma pipeline as a reusable package                     |
| [0010](docs/decisions/0010-behavioural-evals-for-the-skill.md)                 | Evaluate the skill's judgement behaviourally; validate the suite in CI      |
| [0011](docs/decisions/0011-evidence-pack-on-every-pr.md)                       | Every pull request carries a generated evidence pack                        |
| [0012](docs/decisions/0012-cms-step-as-a-second-skill.md)                      | The CMS step is a second skill, evals only, with no extracted code          |
| [0013](docs/decisions/0013-deployment-configuration.md)                        | Deployment config in repository secrets/variables; sqlite is not serverless |
| [0014](docs/decisions/0014-media-on-blob-storage.md)                           | Uploaded media on blob storage; a production build without it fails         |
| [0015](docs/decisions/0015-a-checker-must-prove-it-checked-the-right-thing.md) | A check that cannot confirm what it looked at says so, once                 |

Full design spec:
[`docs/superpowers/specs/2026-08-21-figma-to-cms-pipeline-design.md`](docs/superpowers/specs/2026-08-21-figma-to-cms-pipeline-design.md).
Design-token literals not bound to a Figma variable, and the gaps the fidelity
check cannot see: [`apps/web/TOKEN-GAPS.md`](apps/web/TOKEN-GAPS.md).
