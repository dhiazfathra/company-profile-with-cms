---
name: modern-product-launch-pipeline
tags: [pipeline, real-file, capture, verify]
runs: 2
max_turns: 6
timeout_seconds: 420
allowed_tools: []
---

I need to build a marketing site from this Figma file:

https://www.figma.com/design/v7ZzmwgTae9hxdKdNdAe7V/Modern-Product-Launch?t=9C2Wr5CYt5lkpz1o-0

Facts about my situation:

- The file is publicly viewable. I am on a free Figma seat — I have no Dev Mode
  and no paid-seat access.
- The page has eleven sections: Navigation, Header, LogoCloud, Benefits,
  FeaturesCarousel, Specifications, Testimonial, HowItWorks, ShowcaseImage,
  CenteredCta, Footer.
- I need the hero laptop image, four feature icons at 24x24, six partner logos,
  and a per-section reference image for each of the eleven sections.
- It is a Next.js app and I already have Playwright and a CI pipeline.

Give me the plan: how I get the assets out, what I record about them, and what in
my build will fail if the rendered page stops matching the design. Be concrete —
name the files you would create and the numbers you would need before writing any
component.

Do not write the implementation. I want the plan and the reasoning behind each
part of it.
