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

| Asset | Figma node | Placeholder path in content |
|---|---|---|
| Header hero image | `1:122` | `/img/placeholder-header.png` |
| Benefits section image | `1:166` | `/img/placeholder-benefits.png` |
| Features carousel image | `1:187` | `/img/placeholder-features-carousel.png` |
| Testimonial portrait | `1:224` | `/img/placeholder-testimonial.png` |
| Showcase image | `1:252` | `/img/placeholder-showcase.png` |
| Cable icon | `1:147` | `/icons/placeholder-cable.svg` |
| Earth icon | `1:152` | `/icons/placeholder-earth.svg` |
| Account icon | `1:157` | `/icons/placeholder-account.svg` |
| Chart icon | `1:162` | `/icons/placeholder-chart.svg` |
| Footer logo | `1:264` | `/img/placeholder-footer-logo.svg` |

Downloaded successfully: `public/img/logo-1.png`–`logo-6.png`,
`public/icons/check.svg`, `public/icons/close.svg`,
`public/icons/arrow-linkout.svg`.

## Reference screenshots not captured

Same rate limit. `design/refs/` holds 9 of the 11 sections; missing:

| Section | Figma node |
|---|---|
| `CenteredCta` | `1:253` |
| `Footer` | `1:257` |
