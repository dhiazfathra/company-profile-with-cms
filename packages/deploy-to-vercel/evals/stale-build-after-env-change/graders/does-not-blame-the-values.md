---
type: llm
criteria: 'Does the answer correctly diagnose the cause as the reused build predating the env var change, rather than suggesting the env var values themselves are wrong, need re-entering, or need a different variable name — and does it distinguish `vercel redeploy` (reuses an old build) from a fresh `vercel deploy --prod` (rebuilds against current env) as the fix?'
focus: 'Whether the answer chases the wrong culprit — re-checking token validity, variable names, or environment scoping — when the actual defect is the command choice: a promotion of a stale artifact rather than a fresh build.'
---

A plausible but wrong path here is to have the user re-verify the token, check
for typos, or re-add the variable — all of which would appear to "fix" a
problem that was never in the variable's value. The correct diagnosis is
narrower and mechanical: this specific build artifact was compiled before the
variable existed, and no amount of correcting the variable changes an
already-compiled bundle.
