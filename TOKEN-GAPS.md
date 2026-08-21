# Token Gaps

Values present in the Figma file (`v7ZzmwgTae9hxdKdNdAe7V`, Desktop `1:118`) that
are **not** bound to a Figma variable. Each is a literal in the code and will
drift if the design changes.

## Colour and typography literals

| Value | Where it appears | Suggested variable |
|---|---|---|
| `Rethink Sans` Medium 22.857px | Specifications table, Column 2 header "WebSurge" (`1:207`) | `--font-competitor-b` — one-off face, not in the type scale |
| `Reddit Mono` Medium 21.654px | Specifications table, Column 3 header "HyperView" (`1:216`) | `--font-competitor-c` — one-off face, not in the type scale |
| `DM Sans` Medium 30px / `-1.5px` | Navigation wordmark "Area" (`I1:119;2251:635`) | `--type-wordmark` |
| `DM Sans` Medium 25.714px / `-2.0571px` | Specifications table, Column 1 header "Area" (`1:198`) | `--type-table-header` |
| `-0.35px` letter-spacing | Every button label (`1:185`, `1:194`, `1:233`, `1:256`) | the `Link` variable declares `-2.5px`; the rendered value is a local override |
| `-0.12px` letter-spacing | Every specifications table row label | the `Captions` variable declares `-1px`; the rendered value is a local override |
| `rgba(0,0,0,0.08)` shadow, `0px 2px 8px` | Specifications Column 1 card (`1:196`) | `--shadow-card` |
| `0.6` opacity + `mix-blend-exclusion` | all six logo-cloud logos (`1:128`–`1:138`) | `--opacity-logo-muted` |

## Spacing and radius literals

No spacing, radius, or size variables exist in the file at all — every one of
these is a raw literal:

| Value | Where it appears | Suggested variable |
|---|---|---|
| `1000px` radius | all buttons | `--radius-pill` |
| `20px` radius | Specifications Column 1 card | `--radius-card` |
| `22px` / `14px` padding | all buttons | `--space-button-x` / `--space-button-y` |
| `30px` / `32px` / `40px` padding | Specifications table cells | `--space-table-cell` |
| `50px` block padding, `20px 40px` gap | Logo cloud (`1:124`, `1:126`) | `--space-section` / `--space-logo-gap` |
| `148px` height, `80px` bottom padding | Navigation bar | `--space-nav` |
| `1500px` max-width | Navigation inner container | `--width-container` |
| `84px` × `154px` | logo-cloud tiles | `--size-logo-tile` |
| `14px` | check / close icons in the table | `--size-icon-sm` |

## Typeface substitution

`--font-display` resolves to Crimson Text, which is **not** the face the Figma
file uses — the file's display face has not been identified from the reference
rasters. The difference is measurable: "Browse everything." at 160px occupies
1068 design px in `design/refs/Header.png` and advances 1132 px in Crimson Text,
so the header headline wrapped to two lines and made the whole section 145px too
tall. `components/sections/Header.tsx` carries `lg:tracking-[-8px]` as a
compensation derived from that measurement.

That tracking value is a workaround, not a design token. Identifying the real
typeface would let it be deleted. Until then the same substitution error is
present, unmeasured, in every other heading on the page — the fidelity check
tolerates it because it changes advance width rather than section geometry.

## Assets — resolved

The Figma MCP Starter-plan tool-call limit was reached mid-extraction, and the
ten assets below shipped as placeholder SVGs. `scripts/capture-figma.mjs`
has since captured the real PNGs for all of them; `content/` now points at
the real files and the placeholder SVGs are unused (left on disk, harmless).

Three of those captures were wrong, and shipped. The crop locates a node by the
width and height declared for it in the script's `TARGETS` table and takes the
closest-matching selection outline, so a wrong declared size does not fail — it
returns a different region of canvas. See `docs/decisions/0007` and `0008`.

| Target | Was declared | Actually | What shipped |
|---|---|---|---|
| `Header` (`1-122`) | 1200x362 | correct for that node — but the node is the green *band*, not the hero image | the band, which `Header.tsx` then nested inside a second band of its own |
| `Footer` (`1-257`) | 1200x519 | 1200x250 | a strip of Figma's own UI — selection badge, canvas, cookie banner — as a design *reference* |
| `Showcase` (`1-252`) | 1200x664 | 1200x704 | the picture with 40px cropped away |

`Header` now exports the laptop alone via a design-px offset from the band's
outline (`cropRelative`), because the laptop is clipped by its parent frame and
selecting it directly does not yield its pixels. The band itself is a flat colour
reproduced in CSS.

| Asset | Figma node | Path in content |
|---|---|---|
| Header hero image | `1:122` + offset | `/img/header.png` |
| Benefits section image | `1:166` | `/img/benefits.png` |
| Features carousel image | `1:187` | `/img/features-carousel.png` |
| Testimonial portrait | `1:224` | `/img/testimonial.png` |
| Showcase image | `1:252` | `/img/showcase.png` |
| Cable icon | `1:147` | `/icons/cable.png` |
| Earth icon | `1:152` | `/icons/earth.png` |
| Account icon | `1:157` | `/icons/account.png` |
| Chart icon | `1:162` | `/icons/chart.png` |
| Footer logo | `1:264` | `/img/footer-logo.png` |

Downloaded successfully: `public/img/logo-1.png`–`logo-6.png`,
`public/icons/check.svg`, `public/icons/close.svg`,
`public/icons/arrow-linkout.svg`.

## Reference screenshots

`design/refs/` holds all 11 sections, including `CenteredCta` (`1:253`) and
`Footer` (`1:257`) captured after the original rate limit cleared.
`design/refs/refs.json` records, per section, the design size the render is
checked against, where that number came from, and whether the PNG is trustworthy
enough to compare content against — with a reason wherever it is not, or wherever
its tolerance is loosened. `bun run verify:design` and
`e2e/design-fidelity.spec.ts` read it.

These are canvas rasters from the free-tier web viewer, not asset exports: they
are softer than an export would be and vector icons arrive rasterised. They are
good enough to check composition and geometry, which is what they are used for,
and not good enough to check hairline detail.

Known gaps the fidelity check cannot see:

- The block comparison is coarse, so on a section that is nearly all background
  (`LogoCloud`, `Footer`) a low score is weak evidence of fidelity.
- The design puts the footer copyright at the left and "All Rights Reserved" at
  the right. The build renders them as one field, deliberately — collapsing them
  keeps the sentence translatable as a unit — and the check is too coarse to
  notice the difference.
- Only Chromium at one width (1200 design px) is checked. Nothing compares the
  responsive breakpoints against the file's mobile and tablet frames.

## Accessibility gaps in the manifest

One `image` field has no sibling alt-text field, so its component renders it
as decorative (`alt=""`), which is defensible there:

| Field | Why it matters |
|---|---|
| `BenefitsItem.icon` | The icon restates the item title, so decorative is defensible. |

`SpecificationsCell.icon` **was** in this gap list — the check/cross mark is
the only thing distinguishing "Fast browsing" as supported from "Basic AI
insights" as unsupported. It now has a translatable `iconAlt` field
(`content/collections/SpecificationsCell.json`), wired into
`components/sections/Specifications.tsx` as the icon's `alt` attribute.
