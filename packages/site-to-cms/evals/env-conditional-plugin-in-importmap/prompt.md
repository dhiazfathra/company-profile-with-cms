---
name: env-conditional-plugin-in-importmap
tags: [configuration, generated-files, verification]
runs: 2
max_turns: 5
timeout_seconds: 300
allowed_tools: []
---

Our `payload.config.ts` is generated from `site.manifest.json`, and it registers
Vercel Blob storage for the `media` collection only when the token is present, so
local development keeps writing uploads to disk:

```ts
plugins: [
  ...(process.env.BLOB_READ_WRITE_TOKEN
    ? [
        vercelBlobStorage({
          collections: { [Media.slug]: true },
          token: process.env.BLOB_READ_WRITE_TOKEN,
          clientUploads: true,
        }),
      ]
    : []),
],
```

`app/(payload)/admin/importMap.js` is committed and in `.prettierignore` — it is
generated output, so its generator owns it. CI runs `gen:cms`, diffs
`payload.config.ts`, runs lint, the vitest suite, the Playwright e2e suite
(including `e2e/cms-round-trip.spec.ts`, which signs in to `/admin` and edits
`Header.headline`), and `next build` with `BLOB_READ_WRITE_TOKEN` set to a
placeholder. All green on every push.

I want to add a second storage plugin behind the same pattern later. Before I do
— is there anything about this arrangement that our checks would not catch?
