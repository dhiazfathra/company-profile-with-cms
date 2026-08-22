---
type: llm
criteria: 'Does the answer advise splitting the work — first reshape `content/en.json` into the intended CMS shape while it is still a file, with the existing tests kept passing, and only then change the reader to Payload? Does it give the reason: if shape and source move together, every test that breaks has two possible causes and you cannot tell which, and the tests you rewrite to get green are the tests that were guarding the migration? Does it avoid endorsing the single-pull-request plan on the grounds that it avoids an intermediate half-moved state, and avoid suggesting the tests simply be updated alongside as the way to manage the risk?'
focus: 'The split, and the specific reason: ambiguous failures plus rewriting the guard. An answer that merely says "smaller pull requests are easier to review" has the right conclusion for a generic reason and partially fails. An answer that accepts the combined plan because the seed script transforms the data deterministically fails.'
---

The plan in the prompt is coherent and its stated motivation — no half-migrated
state — sounds like discipline. The cost is hidden in the last clause: "update the
tests to match the new field names".

Those 154 tests are the only thing standing between this change and a silently
broken site, and the plan modifies them in the same commit that changes both the
shape and the source of what they check. Afterwards, nothing has verified the
content survived, because everything that could have was edited to agree with the
result.

Reshaping first is nearly free: the field names change, the tests change with
them, and the site is still reading a file, so any breakage has exactly one
possible cause. Then the migration is a change of reader only, and every one of
those tests keeps its meaning across it.
