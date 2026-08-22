---
type: regex
target: last_message
pattern: '([Tt]hrow|[Ff]ail (?:closed|fast|hard)|[Rr]efuse to (?:start|boot|build)|hard error|[Cc]rash (?:the |at )?(?:boot|start|build))'
match: contains
matchExample: 'throw when NODE_ENV is production and PAYLOAD_SECRET is unset, so the deploy fails closed'
---

The whole correction is that absence becomes an error instead of a default. An
answer that recommends rotating the secret, documenting the variable, or moving it
to a secret manager — all reasonable — while leaving the `??` fallback reachable in
production has not made the change that matters, and will not contain any of these
words.

Several phrasings of the same act are accepted because "throw", "fail closed" and
"refuse to boot" are the same instruction. Whether the answer also handles the
production-build paths is a second requirement, carried by this case's LLM grader.
