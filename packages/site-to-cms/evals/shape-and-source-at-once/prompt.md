---
name: shape-and-source-at-once
tags: [migration, sequencing]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

Planning the CMS migration for our marketing site. Content today lives in
`content/en.json`, which grew organically while we were building the sections
against the design. It does not resemble what I want in the CMS:

- flat keys like `"headerHeadline"`, `"benefit1Title"`, `"footerCopyright"` where
  the CMS should have nested sections
- three separate arrays that should be one collection
- a couple of fields whose names don't match the design's vocabulary at all

We have 131 unit tests and 23 e2e tests over the current content, including a
locale-fallback suite that reads `content/en.json` directly.

My plan is one pull request that does the whole thing: install Payload, define the
schema the way it should be, write a script that transforms `content/en.json` into
the new shape and seeds it, repoint `lib/content.ts` at Payload, and update the
tests to match the new field names. One migration, one review, no intermediate
state where the content is half-moved.

Does that sequencing make sense?
