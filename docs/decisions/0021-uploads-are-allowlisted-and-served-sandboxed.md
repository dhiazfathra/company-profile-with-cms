# ADR-0021: Uploads are MIME-allowlisted and served sandboxed, and the database is not a build artefact

## Status

Accepted

## Date

2026-09-04

## Context

The site had shipped eleven sections, a CMS, a blob store and a fallback for
when that store goes dark (ADR-0020) without anything having yet asked the
adversarial question: what can someone who is not the author make this
deployment do? A review of the deployed surface found four things, of which two
are decisions worth recording and two are repairs.

The surface is small and that is what makes the findings interesting. There is
no user input on the public page — every string comes from Payload through
server components, and React escapes all of it. There is no SQL built by hand;
the local API parameterizes. `/api/media-fallback/[filename]` already rejects
protocol-relative `sourcePath` values so the fallback cannot become an open
redirect. The interesting attack surface is not the page. It is the _upload_.

**The upload.** `Media` was declared `upload: true` with no `mimeTypes`, which
means anything. An editor account — one account, one password, no second
factor — could upload `payload.html` or `x.js`, and `/api/media/file/<name>`
would serve it back with that content type from the site's own origin. That is
same-origin script execution that outlives the session which uploaded it: it can
read the admin cookie of the next person to open the link. The blast radius is
bounded by "you must first have an editor account", which makes it a privilege
escalation rather than an anonymous compromise, but the whole point of an
editor account is that it is handed to people who are trusted to write copy, not
to run code on the domain.

The obvious fix — allowlist image types — does not close it on its own, because
the seeded icons are SVG and an SVG is an XML document that can carry a
`<script>`. Dropping `image/svg+xml` would mean re-exporting every icon as PNG
and re-baselining the design-fidelity gate against fuzzier art.

**The response headers.** The deployment answered with none. No CSP, no HSTS,
no `X-Frame-Options`, no `nosniff`, and `X-Powered-By` announcing the framework
version to anyone scanning for a matching CVE. `nosniff` matters here
specifically: without it a browser is free to sniff an uploaded file's bytes and
decide it is HTML regardless of the content type Payload sent.

**The GraphQL playground.** `/api/graphql-playground` was mounted
unconditionally. Payload's `disablePlaygroundInProduction` default happens to be
on, so it was not open — but the thing standing between the deployment and a
published schema browser for every collection and global was a default in a
dependency, changeable by a minor release, with nothing in this repository
asserting it.

**The database in the repository.** `payload.db` — 548KB of SQLite — was
committed at the repository root. The ignore rule was `apps/web/payload.db`,
anchored, and the adapter's default url is the relative `file:./payload.db`, so
every command run from the root creates a second copy that the rule never
matched. The committed file's `users` and `users_sessions` tables were empty,
which is luck rather than design: on any machine that had run `bun run seed`
before running a root-level command, that file carries an editor's password hash
and a live session token into a public repository. This is the finding that came
closest to being an incident and was not one; see _Consequences_.

## Decision

1. **Allowlist the five image MIME types the seed uploads**, in
   `scripts/gen-cms.ts` so it survives a config regeneration, and **serve
   `/api/media/file/*` under a `default-src 'none'; sandbox` CSP.** `sandbox`
   with no allow-list puts the response in an opaque
   origin with scripting off, which is what actually neutralises an SVG.
   The allowlist and the header are treated as one control in two halves.
2. **Send a full set of response headers site-wide** — CSP, HSTS,
   `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
   COOP — and turn `poweredByHeader` off.
3. **Return 404 from the GraphQL playground in production**, in this
   repository's own code rather than by relying on the upstream default.
4. **Untrack `payload.db` and make the ignore rule unanchored.**
5. **Pin `fast-uri`, `dompurify`, `esbuild` and `uuid` through `overrides`**,
   clearing ten advisories including four highs.

## Alternatives Considered

### Drop `image/svg+xml` from the allowlist instead of sandboxing

- Pros: the simplest possible statement of the rule; no header to lose.
- Cons: the seeded icons are SVG. This means re-exporting them as PNG, which is
  both larger and fuzzier, and re-baselining the design-fidelity gate — a
  change to what the site _looks like_ in order to fix what it _runs_.
- Rejected: the sandbox header neutralises the script vector without touching
  a pixel. The cost is that two things now have to stay true together, which is
  why both halves are asserted by value in `tests/` and why the comment on each
  half names the other.

### A per-request CSP nonce instead of `'unsafe-inline'` in `script-src`

- Pros: an actual defence against injected inline script, rather than a policy
  that documents its own gap.
- Cons: the Payload admin bundle evaluates inline script a nonce does not
  cover. A policy that breaks `/admin` gets deleted within the day, and then
  there is no policy at all.
- Deferred: `'unsafe-inline'` is a known, commented gap. React's escaping is
  what defends the page today. Removing it needs the admin bundle checked
  against a nonce first, which is its own piece of work.

### Rotate the credentials in the committed database and file an incident

- Pros: the conservative reading of "a database reached a public repository".
- Cons: `select count(*) from users` on the committed blob returns 0. There is
  no credential to rotate and no session to revoke. Filing an incident for a
  file with nothing in it spends the incident process's credibility on a
  non-event, and the next real one is read with slightly less urgency.
- Rejected on the evidence, not on convenience. Had that count been non-zero
  this would have been an incident and the ADR would say so.

### `bun update --latest` instead of pinned overrides

- Pros: no override block to maintain.
- Cons: `--latest` takes breaking majors across the whole tree to fix four
  transitive advisories. The direct dependents still range-match the pinned
  versions, so an override raises the floor without forking anyone's API.
- Rejected: the override block carries a comment per entry naming the advisory,
  so an entry can be deleted the moment its dependent moves past it on its own.

## Consequences

- `bun audit` is clean. It was not before, and four of the ten findings were
  high: `fast-uri` SSRF and host confusion, reachable through payload's own
  schema-URI parsing.
- An editor can no longer upload a non-image, and an uploaded SVG can no longer
  run script from this origin. Neither change is visible on the page — the
  design-fidelity gate passes unchanged.
- The two halves of the upload control are asserted by value in
  `tests/media-upload-types.test.ts` and `tests/security-headers.test.ts`. The
  MIME test names the dangerous types individually rather than asserting the
  list is short, because a test that only says "short" passes with `text/html`
  on it.
- `payload.db` is now created and ignored at both paths. Anyone who cloned
  before this commit still has the file in their history; because it holds no
  credentials, this was not rewritten.
- **No incident record was filed.** The one finding that could have warranted
  one — the committed database — held zero user rows, so nothing was exposed
  and nothing needed rotating. This paragraph exists so a future reader can see
  that the question was asked and how it was answered, rather than assuming it
  was not asked.

## Supersedes

Nothing. ADR-0014 and ADR-0020 stand unchanged: blob storage is still where
uploads live and the bundled fallback still catches an unreachable store. This
adds the constraint neither considered — _what_ is allowed into that store, and
what the browser is allowed to do with it on the way back out.
