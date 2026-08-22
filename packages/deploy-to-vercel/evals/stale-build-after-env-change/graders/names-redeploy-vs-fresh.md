---
type: regex
target: last_message
pattern: '(?=[\s\S]*(vercel deploy --prod|fresh (deploy|build)))(?=[\s\S]*(curl|http|runtime check|status code))'
match: contains
matchExample: 'do not assume redeploy picked up the new values — run a fresh vercel deploy --prod, then curl the live URL to confirm the runtime status code'
---

Vercel's CLI describes `vercel redeploy` as rebuilding the deployment, so the
answer must not assert the opposite (that it reuses a prior build's compiled
output) as settled fact — that claim does not hold up against the documented
CLI contract. What the answer must do instead is treat the observed mismatch
as a signal not to assume env-var propagation succeeded, and recommend the
safe, verifiable path: a fresh `vercel deploy --prod`, followed by an actual
runtime check, rather than trusting that redeploying "should have" worked.
