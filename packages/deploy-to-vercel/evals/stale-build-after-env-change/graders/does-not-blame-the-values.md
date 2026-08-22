---
type: llm
criteria: 'Does the answer correctly avoid diagnosing the cause as the env var values themselves being wrong, needing re-entering, or needing a different variable name — and instead treat the command choice (`vercel redeploy` versus a fresh `vercel deploy --prod`) as the thing to change, without asserting as settled fact that redeploy definitely reuses a stale build (since Vercel''s own CLI describes it as a rebuild) — landing on "don''t assume, verify, and prefer a fresh deploy" rather than either blaming the values or overclaiming the mechanism?'
focus: 'Whether the answer chases the wrong culprit — re-checking token validity, variable names, or environment scoping — instead of recognizing this as a command-choice and verification problem. It should also avoid overcorrecting into a confident wrong explanation of exactly why redeploy failed here.'
---

A plausible but wrong path here is to have the user re-verify the token, check
for typos, or re-add the variable — all of which would appear to fix a
problem that was never in the variable's value. An equally wrong path in the
opposite direction is asserting a specific, confident mechanism for why
`vercel redeploy` failed to pick up the change, when the CLI's own
documentation describes it as a rebuild — the honest answer treats this as
an observed, not fully explained, mismatch and recommends the safe practice
(fresh deploy, then verify) rather than either blaming the values or
inventing certainty about the mechanism.
