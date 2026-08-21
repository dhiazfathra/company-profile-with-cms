---
name: badge-in-crop
tags: [capture, chrome, diagnosis]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

I am capturing assets out of a Figma file by screenshotting the web viewer and
cropping to the selection outline. One target is a full-width showcase image:

```json
{ "name": "Showcase", "node": "1-252", "w": 1200, "h": 704, "out": "public/img/showcase.png" }
```

The crop succeeded and wrote the file. When I opened the PNG, there is a small
blue rounded rectangle in the bottom-left with white text in it. Zoomed in, the
text reads:

    1200 Fill x 664.29 Fill

Everything else in the image looks like the design. My fidelity check passes this
section — it scores 1.7 against a limit of 34.

What is wrong and what should I change?
