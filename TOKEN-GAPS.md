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

## Assets not downloaded

The Figma MCP Starter-plan tool-call limit was reached mid-extraction. These are
referenced by **placeholder paths** in `content/` rather than invented binaries.
Task 5 must not ship without them.

| Asset | Figma node | Path in content | Placeholder on disk |
|---|---|---|---|
| Header hero image | `1:122` | `/img/placeholder-header.svg` | yes |
| Benefits section image | `1:166` | `/img/placeholder-benefits.svg` | yes |
| Features carousel image | `1:187` | `/img/placeholder-features-carousel.svg` | yes |
| Testimonial portrait | `1:224` | `/img/placeholder-testimonial.svg` | yes |
| Showcase image | `1:252` | `/img/placeholder-showcase.svg` | yes |
| Cable icon | `1:147` | `/icons/placeholder-cable.svg` | yes |
| Earth icon | `1:152` | `/icons/placeholder-earth.svg` | yes |
| Account icon | `1:157` | `/icons/placeholder-account.svg` | yes |
| Chart icon | `1:162` | `/icons/placeholder-chart.svg` | yes |
| Footer logo | `1:264` | `/img/placeholder-footer-logo.svg` | yes |

**Task 5 update.** Every path above now resolves to a real file in `public/`:
a grey (`#e9e9e9`) rectangle with a `#929292` hairline border and its own
filename set in `#6f6f6f` — visibly a placeholder, never mistakable for the
photograph it stands in for. Photographic placeholders are 1280x720; icon and
logo placeholders are 160x96. Nothing 404s and the static export is honest about
what is missing.

The five photographic entries were `.png` in `content/` and are now `.svg`,
because serving an SVG at a `.png` path would misrepresent the file's type.
Replacing a placeholder therefore means one `download_assets` run on a paid
Figma seat **plus** correcting that entry's extension back in `content/`.

Downloaded successfully: `public/img/logo-1.png`–`logo-6.png`,
`public/icons/check.svg`, `public/icons/close.svg`,
`public/icons/arrow-linkout.svg`.

## Reference screenshots not captured

Same rate limit. `design/refs/` holds 9 of the 11 sections; missing:

| Section | Figma node |
|---|---|
| `CenteredCta` | `1:253` |
| `Footer` | `1:257` |

## Accessibility gaps in the manifest

Two `image` fields have no sibling alt-text field, so Task 5's components render
them as decorative (`alt=""`), which loses information a screen-reader user
needs:

| Field | Why it matters |
|---|---|
| `BenefitsItem.icon` | The icon restates the item title, so decorative is defensible. |
| `SpecificationsCell.icon` | **Not decorative.** The check/cross mark is the only thing distinguishing "Fast browsing" as supported from "Basic AI insights" as unsupported. A screen reader currently hears the label alone. Needs a translatable `iconAlt` field before Phase 2 freezes the schema. |
