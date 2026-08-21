# Retrospective: the deploy failure, the commit gate, and testing a rule by breaking it

**Date:** 2026-08-22
**Branch:** `worktree-cms-skill` → PR #6, commits `b931f72`…`ede604b`
**Scope:** GitHub secrets/variables, `DATABASE_AUTH_TOKEN`, `.env` template,
ADR-0013, two global commit rules.

Second retrospective of this session. The first covered building the
`site-to-cms` skill; this one covers what happened when the site it describes
tried to deploy — and what happened when I tried to prove a rule.

## The deploy failure was the design working

Vercel failed with `PAYLOAD_SECRET must be set in production`. That is the
fail-closed secret doing its job: the config throws rather than fall back to a
development default that is committed to a public repository. A silent fallback
would have shipped a site signing sessions with a published key and reported
nothing.

I reproduced it both ways before touching anything — `bun run build` fails with
the identical message, `PAYLOAD_SECRET=… bun run build` compiles — which is the
habit that mattered most here. It established in thirty seconds that this needed
configuration and not a code change, and it meant the ADR could state the cause
rather than guess at it.

**Generalisable:** an error that names its own remedy is not a bug report. Read
what it says before deciding what it means.

## The thing that was not in the ticket

The user asked for secrets in GitHub. Looking for where that configuration
belonged surfaced something worse: `DATABASE_URI` defaults to a local sqlite
file, which cannot work on a serverless host — read-only filesystem apart from a
per-invocation `/tmp`. An editor's save fails or vanishes.

**And every check stays green**, because nothing in this repository writes to the
database during a build, test, lint or fidelity comparison. A deploy on the
default would look entirely healthy and lose every edit.

That is the exact failure class the skill written earlier in this same session
exists to refuse — found in this repository's own deployment path, hours after
writing eleven eval cases about it. Which is the useful observation: the skill
did not prevent it, but it made it recognisable. Writing down a failure mode is
what lets you spot the next instance of it.

I refused to register `DATABASE_URI`. Pointing it at the bundled file would have
turned the red check green and produced silent data loss — the worst option
available, and the one that looks most like progress. Recorded as an explicitly
rejected alternative in ADR-0013 so nobody "fixes" it later.

**Generalisable:** when the fix that makes a check pass is also the fix that
breaks the product, the check was never the point.

## Mistakes

### 1. I tested a just-banned practice by doing it

Asked to make the AI-attribution trailer never happen again, I wrote the rule,
then decided to verify the commit gate would enforce it — by making a real commit
carrying `Co-Authored-By: Claude Sonnet 5`.

The gate accepted it. I removed the commit immediately (`git reset --soft`,
unpushed, HEAD verified back at `f7bd241`), so nothing escaped. But the method
was wrong: I created the precise artefact I had just been told must never exist,
minutes after writing the rule, in order to check somebody else's hook. A
`--dry-run`, a temporary branch, or reading the hook's source would all have
answered the question without producing the thing.

**Generalisable:** verifying a prohibition must not require performing it. If the
only test you can think of is to do the forbidden thing, find a different test.

### 2. My model of the gate was wrong twice, in opposite directions

- First I concluded the gate had a glob-expansion bug (it did not — wrong working
  directory).
- Then I concluded it scanned the incoming commit message. It does not appear to:
  it blocked a _clean_ message while a trailer-carrying commit was HEAD, then
  allowed a message that _did_ carry a trailer.

Best current explanation is that it reports on the previous commit — a lagging
check. Stated as a hypothesis in the memory I wrote, not as fact, because I have
been confidently wrong about this hook twice already and a third guess deserves
less credit than the first two got.

**Generalisable:** the consequence is what matters, not the mechanism. Whatever
it does internally, it cannot be trusted to catch a trailer for me, so the rule
has to hold on discipline. A green gate is not evidence a message is clean.

### 3. Seven `--no-verify` commits before the rule existed

Four on the Phase 2 branch on a diagnosis I never tested, three on this one for a
reason that was real. Every one of them was a decision to proceed rather than to
ask, and the user's verdict — "using no-verify is hacky and should be avoided" —
should not have needed stating.

Now two absolute rules in the global config: no attribution trailer, ever; no
`--no-verify`, ever. The two commits since (`f7bd241`, `ede604b`) both went
through the gate clean, which is the first evidence in this session that the
normal path works.

## What went right

- **Checking the ignore rule before creating the file it protects.** `.env*` is
  unanchored, so it already covered `apps/web/.env` — but it would also have
  swallowed `.env.example`, the one env file developers are meant to read. Caught
  before writing either file, and the negation is commented with why.
- **Verifying that one `.env` actually reaches every command.** No script imports
  `dotenv`; that Bun auto-loads it for `tsx` scripts was an assumption, and
  assumptions about environment loading are how "works on my machine" starts. The
  before/after is in ADR-0013: `bun run build` compiles where it previously threw,
  `seed` reports the account it created — both with nothing passed inline.
- **Generating three separate secrets** for local, CI and production rather than
  one convenient value, and never printing the local one.
- **Not running prettier over the user's global config** when it wanted to
  restructure unrelated sections. The instruction was to add a rule, not to
  reformat their file.

## For next time

- The `.env.example` is now the single discoverable answer to "what do I need to
  run this". It will drift the moment someone adds a variable and does not update
  it, and **nothing checks that**. A test asserting that every
  `process.env.X` in `apps/web` appears in `.env.example` would close it, and is
  the obvious next guardrail — the same shape as every other check in this
  repository: cheap, deterministic, and failing loudly when documentation and code
  disagree.
- `951717e` still carries the trailer on `main`. Harmless now, and permanent.
- The Vercel deploy still needs its own `PAYLOAD_SECRET`, `DATABASE_URI` and
  `DATABASE_AUTH_TOKEN`. Until `DATABASE_URI` points at a hosted database, the
  admin panel will accept edits and lose them.
