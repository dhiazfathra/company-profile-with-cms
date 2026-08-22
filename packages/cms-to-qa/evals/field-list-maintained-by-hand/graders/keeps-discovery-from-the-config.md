---
type: regex
target: last_message
pattern: '(running config|payload\.config|discovered from the (?:running |live )?config|the config the (?:running |admin )?panel uses|sanitized config)'
match: contains
matchExample: 'keep discovering from payload.config.ts — the running config is what the admin panel actually serves'
---

The rule under test names its source precisely: the field list comes from the
config the running panel uses, never from a list anyone wrote. An answer that picks
either offered option will not point back at the running config. This is a weak
necessary condition — it cannot tell endorsement from mention — and the rejection
of both options is carried by this case's LLM grader.
