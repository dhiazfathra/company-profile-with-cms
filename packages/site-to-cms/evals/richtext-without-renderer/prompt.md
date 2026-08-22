---
name: richtext-without-renderer
tags: [modelling, validator, generation]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

An editor has asked to be able to bold a word or two inside the Benefits card
body copy. Right now `BenefitsItem.body` is a plain text field in
`site.manifest.json`, and the manifest's Zod schema restricts field types to
`text`, `url`, `image` and `number` — no `richText`.

Payload supports `richText` out of the box, and our generator (`scripts/gen-cms.ts`)
would emit the field with a two-line change. The site's loader, `lib/content.ts`,
reads each section's fields and hands them to the section components as plain
values; every component renders its fields directly, e.g.
`<p className="...">{item.body}</p>`.

So the change I'm planning is:

1. add `'richText'` to the `type` enum in `schemas/manifest.ts`
2. add the `richText` case to `fieldSource()` in the generator
3. change `BenefitsItem.body` to `"type": "richText"` and regenerate

That's the whole diff. Nothing else needs to change and it typechecks. Sound
right?
