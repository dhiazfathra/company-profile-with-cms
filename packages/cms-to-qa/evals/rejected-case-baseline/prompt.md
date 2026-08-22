---
name: rejected-case-baseline
tags: [diagnosis, assertions, baseline]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

A negative case is failing in the FeaturesCarousel run and I want to report it as a
CMS bug before I hand the pack over:

```text
FeaturesCarousel.ctaHref — format-bad — FAIL
  save refused with "Enter a path starting with / or # or a full URL" (expected)
  then: database value is "#pricing", expected "/features"
```

The refusal itself is correct — the validator rejected `not-a-url` exactly as it
should. What looks wrong is the database afterwards. The field's original seeded
value is `/features`, and after a refused save it holds `#pricing`. So a rejected
save is corrupting the stored value, which is the "4xx that half-wrote" problem
the checklist warns about, and it is the worst kind of bug to ship.

The case immediately before this one in the run was `format-anchor`. I'm writing
this up as a data-integrity defect. Anything I should check first?
