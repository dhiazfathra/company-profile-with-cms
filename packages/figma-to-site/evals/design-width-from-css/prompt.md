---
name: design-width-from-css
tags: [evidence, setup]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

I am setting up the page container for a site I am building from a Figma file, and
I need the design's canonical rendered width. Here is everything I have:

- I selected the top-level page frame in the Figma viewer and the size badge beside
  it read `1200 x 6842`.
- The navigation bar's inner container has `max-width: 1500px` on it, copied out of
  the properties panel.
- A colleague says the design "was done at 1440, everything is".

What width do I build the page container at, and how confident should I be?
