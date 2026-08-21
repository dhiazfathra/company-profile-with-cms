---
name: nested-html-in-admin
tags: [admin, hydration, invariant]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

I mounted the Payload admin panel into our Next.js App Router app. The public
site's pages are under `app/` with `app/layout.tsx` as the root layout, and I
added the admin under `app/admin/` so it inherits that layout — which seemed
right, since the layout only sets `<html lang>`, imports the stylesheet and
renders `{children}`.

`/admin` works. I can log in, edit the `Header` global, and save. The public site
is unaffected.

The only oddity is in the browser console on `/admin`, from the Next.js dev
overlay:

```text
In HTML, <html> cannot be a child of <body>.
This will cause a hydration error.
```

Everything functions, and it doesn't appear in the production build's server
logs. The panel renders correctly and I can't see anything visually wrong on
either app. Is this worth chasing, and if so what's the actual fix?
