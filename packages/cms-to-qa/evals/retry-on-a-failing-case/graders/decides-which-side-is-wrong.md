---
type: regex
target: last_message
pattern: '([Tt]he (?:expectation|assertion|generator) is wrong|generator.s expectation|correctly refus|[Rr]ightly refus|expectation, not the CMS|assertion is wrong)'
match: contains
matchExample: 'the generator expectation is wrong here — whitespace on a URL field is correctly refused by the validator'
---

The correct answer turns on locating the defect: the CMS behaved correctly and the
generated expectation did not. An answer that picks one of the two offered fixes,
or that debugs the validator, never states which side is wrong. This grader asserts
the answer got as far as naming the expectation as the faulty half — direction and
the refusal of retries are carried by this case's LLM grader.
