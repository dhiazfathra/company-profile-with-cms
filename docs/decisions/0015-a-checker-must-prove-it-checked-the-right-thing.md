# ADR-0015: A checker must prove it looked at the right thing

## Status

Accepted

## Date

2026-08-22

## Context

`bun run parity-report` exists because a deployment can differ from local in
ways no local gate can see (ADR-0014). Its first real use produced a report that
was, in the reader's words, eleven broken sections. It was not. The report had
been pointed at a **preview** deployment URL, and preview deployments on this
project have Vercel deployment protection on. That URL answers:

```text
curl -s -o /dev/null -w '%{http_code}\n' https://company-profile-with-cms-nu5j6jx2x.vercel.app
302
```

The script fetched with `redirect: 'follow'`, landed on Vercel's login page,
received a perfectly good `200` and a perfectly valid HTML document, found no
`data-section` markers in it, and concluded — one row at a time, eleven times —
"section not rendered". Then Playwright screenshotted the same login page and the
gallery filled with placeholders.

Every individual step was correct. The output was still wrong in the way that
matters: **it blamed the app for a problem with the URL**, and it did so in the
vocabulary of a real defect, so the only way to find out was to re-run the thing
by hand. A reader who trusted it would have gone looking for eleven missing
sections in a site that renders all eleven.

This is the same failure class as the defect the script was written to catch, one
level up. ADR-0014's defect was a green check that had not looked at the
deployment at all. This one is a red check that had not looked at the app at all.
In both cases the check reported confidently on something it never saw.

The second half of the same session found the other half of this: the deployment
really was serving broken images, and `parity-report` pointed at the production
URL says exactly which ones and why —

```text
Specifications: deployed=fail  18/18 images failed — /api/media/file/close-33.svg returned 500
```

— so the tool was right, and the misleading run was entirely about which URL it
had been handed.

## Decision

**A check that cannot confirm it is looking at its subject reports that, and
reports it once, instead of reporting on the subject.**

Concretely, in `scripts/parity-report.mjs`:

- `notAppReason(baseUrl, page)` decides whether a response is this site at all.
  Zero `data-section` markers anywhere on the page means it is not, and the
  reason distinguishes the two ways that happens: the response came from a
  different origin than the one asked (a redirect to a login page, a parked
  domain), or the origin was right and the markup was not.
- An environment in that state gets `servedApp: false` and a single reason
  string. `verdict()` returns that reason for every section, so no row claims a
  section is missing. The HTML report leads with a red banner naming the URL and
  the reason, above the summary cards; the console prints the same line first,
  prefixed `!!`.
- No screenshots are taken from such an environment. Eleven identical shots of a
  login page, laid out beside the design references, read as a redesign.
- `/admin` is not probed either, because the login page's status is not the
  admin panel's health.

The exit code stays 1. This is still a failure — the run did not establish
parity — but it now fails with the reason a reader can act on.

## Alternatives considered

### Fail hard: throw on the first environment that does not look like the app

- Pros: impossible to misread, one line of code.
- Cons: throws away the columns that _were_ checked. A run whose deployment URL
  is protected can still tell you that the design references are vouched and
  that local renders every section; discarding that makes the tool less useful
  in exactly the situation where a reader needs the most help.
- Rejected.

### Detect Vercel's login page specifically (by URL pattern or page content)

- Pros: the most precise message possible for the case that actually happened.
- Cons: it is a check for one host's current login flow, which will be
  rewritten. The generic question — "did the thing I am about to grade even
  answer me?" — covers Vercel protection, a wrong URL, a parked domain, a
  maintenance page, and an nginx default page, in less code.
- Rejected.

### Send an authentication bypass token so protected previews can be checked

- Pros: would let the report run against preview deployments, which is where a
  reviewer looks first.
- Cons: a second secret whose only purpose is to let a checker in, and it does
  not remove the failure mode — it moves it to "the token expired", which
  reproduces exactly the same misleading eleven rows. Worth revisiting only
  once someone actually needs preview parity; the deliberate choice
  (`.github/workflows/parity.yml`) is to check the **production** deployment
  after it goes live.
- Rejected for now, and recorded here so the next person does not re-derive it.

## Consequences

- **Three cases are covered by tests, in both directions**
  (`apps/web/tests/parity-report.test.ts`): a page with markers is accepted, a
  redirect names the host it landed on, and a same-origin page with no markers is
  reported as not this app. Plus the `verdict()` case that asserts the URL reason
  replaces `section not rendered` — a detector that has only seen good input is
  not known to detect anything (ADR-0011).
- **A protected preview URL is now a one-line answer**, and the CI workflow no
  longer walks into one. `.github/workflows/parity.yml` fires on a successful
  **production** `deployment_status` and checks the production **alias** —
  `vars.PRODUCTION_URL`, defaulting to the known one — rather than the event's
  `target_url`, which is a per-deployment URL and therefore protected. Parity is
  a claim about what the public sees, so the URL to check is the one the public
  has. A run someone triggers by hand against a preview URL now says why it
  cannot be used instead of inventing eleven defects.
- **The rule generalises, and is worth applying to the next checker written
  here.** Any gate that fetches something before grading it — the evidence
  pack's local server probe, an e2e suite's `baseURL`, a future performance
  check — can be handed the wrong thing. State what you verified you were
  looking at, or say you could not.
- **It does not make the report right about anything else.** The report still
  only asks whether things loaded and whether text is present; the side-by-side
  screenshots are there because no assertion in it can see a section that
  renders wrongly. That blind spot is unchanged and still named in the report
  itself.
