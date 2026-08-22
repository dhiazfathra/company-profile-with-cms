---
name: every-case-missing-the-locator
tags: [diagnosis, hidden-fields, inventory]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

The FooterLink run has one field that fails on every single case, identically:

```text
FooterLink._seedIndex — 6 cases generated, 6 failed
  locator resolved to 0 elements: #field-_seedIndex
```

Every other field on the page passes all of its cases. `label` and `href` are
clean. The failures are all the same timeout on the same missing selector, at
every case kind — happy, empty, whitespace, unicode, long, injection.

I think the suite is broken: the selector convention must have changed in the
Payload version we upgraded to, so `#field-<name>` no longer resolves. I want to
rewrite the locator strategy in `cms-fields.spec.ts` to find inputs by label text
instead, which will be more robust anyway. Sound right?
