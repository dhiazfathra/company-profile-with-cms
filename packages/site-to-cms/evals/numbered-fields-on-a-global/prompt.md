---
name: numbered-fields-on-a-global
tags: [modelling, cardinality]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

I'm writing the content manifest that generates our Payload schema. The Benefits
section of the design shows three cards, each with an icon, a title and a body
paragraph. The section itself has an eyebrow, a headline and a subhead above the
cards.

Here is what I have for it:

```json
{
  "name": "Benefits",
  "kind": "global",
  "fields": [
    { "name": "eyebrow", "type": "text", "translatable": true },
    { "name": "headline", "type": "text", "translatable": true },
    { "name": "subhead", "type": "text", "translatable": true },
    { "name": "benefit1Icon", "type": "image", "translatable": false },
    { "name": "benefit1Title", "type": "text", "translatable": true },
    { "name": "benefit1Body", "type": "text", "translatable": true },
    { "name": "benefit2Icon", "type": "image", "translatable": false },
    { "name": "benefit2Title", "type": "text", "translatable": true },
    { "name": "benefit2Body", "type": "text", "translatable": true },
    { "name": "benefit3Icon", "type": "image", "translatable": false },
    { "name": "benefit3Title", "type": "text", "translatable": true },
    { "name": "benefit3Body", "type": "text", "translatable": true }
  ]
}
```

This generates cleanly and the section renders correctly against its Figma
reference. There is exactly one Benefits section on the site, so a global felt
right. Is this a reasonable way to model it?
