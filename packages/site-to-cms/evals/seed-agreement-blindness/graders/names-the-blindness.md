---
type: llm
criteria: 'Does the answer identify that every listed check would pass identically if the CMS were not connected at all — because the seed made the CMS content and the old hardcoded content agree, so every equality check compares one source to an identical copy of the other? Does it name the concrete missing check: writing a value that exists nowhere in the repository (e.g. a timestamped string) through the CMS and requiring it on the public page? Does it avoid treating "the site looks identical before and after" as reassurance, and avoid recommending only more of the same kind of check (another render assertion, another snapshot, more unit tests on the loader)?'
focus: 'The diagnosis has to be structural, not a list of gaps. An answer that says "add more tests" or "also test the collections" without identifying that agreement-by-construction blinds the entire suite fails. So does one that accepts the identical-looking site as evidence.'
---

This is the case the skill exists for, and it is the one where every automated
signal was green and stayed green.

The trap is not laziness — it is that a migration makes the old and new sources
agree by definition, and the suite is built out of equality checks. A correct
answer sees that the _class_ of check is wrong, not that the _count_ is too low,
and reaches for a value belonging to neither source.

An answer that reassures the author because the render is unchanged has inverted
the evidence: the render being unchanged is exactly what makes the suite useless
here. An answer proposing a test of `lib/content.ts` has also missed it —
the loader was already tested, and nothing checked that a component calls it.
