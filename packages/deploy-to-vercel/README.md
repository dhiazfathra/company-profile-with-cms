# deploy-to-vercel

A skill that walks a user step-by-step through deploying a Next.js app (with
an optional Payload CMS + SQLite/libSQL database) to Vercel from a completely
fresh machine, and through **verifying** the deployment rather than stopping
at a green build.

`SKILL.md` is the walkthrough. `evals/` grades whether an agent reading it
reaches the judgement calls it was written to force — the ones this
repository's own first deployment got wrong: a blank `DATABASE_URI` treated
as harmless, a green build treated as proof, a stale build redeployed after
env vars changed, a bundled sqlite file registered "to make the check pass,"
a credential typed where an agent could see it, and an empty remote database
mistaken for a working one.

## Layout

```
deploy-to-vercel/
  SKILL.md
  README.md
  evals/
    <case>/
      prompt.md          # frontmatter + the scenario put to the agent
      graders/*.md        # one assertion each
```

Every case is a pure reasoning case: `allowed_tools: []`, no network, no
Vercel/Turso account, no live deploy. The scenarios reuse the exact error
strings, file paths, and env var names from the real incident this skill was
built from, so a case cannot be satisfied by generic deployment advice.

## Cases

| Case                            | The judgement under test                                                          | Its source                                                      |
| ------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `blank-env-is-not-unset`        | An empty string is falsy — `X \|\| default` treats blank identically to unset     | `DATABASE_URI=` left blank, falling back to `file:./payload.db` |
| `green-build-is-not-proof`      | A build never writes to the database, so it cannot prove the app works            | Vercel's build step vs. `SQLITE_CANTOPEN` at runtime            |
| `stale-build-after-env-change`  | Redeploying a prior build does not pick up env vars set after that build ran      | the conditional `authToken` spread baked in at build time       |
| `bundled-file-to-go-green`      | Pointing production at a bundled local file "to make it work" is silent data loss | ADR-0013's explicitly rejected alternative                      |
| `never-handle-the-token`        | An agent must not see or type an auth token, even when handed one directly        | the credential-boundary rule this skill states in step 1        |
| `empty-remote-db-after-linking` | A newly linked database has zero tables — schema and data must be pushed first    | Turso `db create` producing an empty database                   |

## Running

`claude plugin eval` is in early access. Where it is enabled:

```bash
cd packages/deploy-to-vercel
claude plugin eval . --threshold 0.8
```

`.` resolves this directory as a skills-dir plugin (`SKILL.md` at its root)
and `evals/` is the default eval directory. Scores and the HTML report land
in `evals/results/<timestamp>/`, which is ignored.

`tests/evals.test.mjs` asserts the suite's own structure (every case loadable,
every grader well-formed) on every push, independent of the early-access
gate — the same reasoning as `packages/figma-to-site`'s suite: a check nobody
can run is not a check.
