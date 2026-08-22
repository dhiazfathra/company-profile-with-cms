---
type: llm
criteria: 'Does the answer require the config to THROW when the secret is absent and the environment is production, keeping the fallback only for development — rather than accepting "deployment sets it" as sufficient? Does it explain the consequence of the silent fallback: any deploy that fails to set the variable signs sessions with a value published in the public repository, and nothing reports it, so the failure is a security hole rather than an outage. Does it also address the second question correctly — that once the config throws in production mode, every path that triggers a production build (the CI build step, any local evidence or release script) must supply the variable, and that CI being green today is not evidence the arrangement is safe?'
focus: 'Fail-closed on production, plus the follow-on that production-build paths then need the variable. An answer that only says "use a real secret in production" without making the absence an error fails. Suggesting the fallback be removed entirely is acceptable if the answer acknowledges the onboarding cost it reintroduces.'
---

The arrangement in the prompt is not wrong about where the secret comes from — it
is wrong about what happens when it does not. A missing environment variable in
production should be the cheapest possible failure, a deploy that refuses to start;
the fallback converts it into a running site with a published signing key.

The second half is the part usually missed, and this repository missed it. Making
the config throw in production mode means anything that runs a production build now
depends on the variable — and the reason the gap stayed invisible for a long time
is that the local pipeline happened to run in an environment where `NODE_ENV` was
not production, so the throw never fired.

"CI is green" is therefore evidence about CI's environment, not about the config.
