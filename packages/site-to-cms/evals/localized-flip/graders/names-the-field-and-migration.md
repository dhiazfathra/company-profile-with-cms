---
type: regex
target: last_message
pattern: 'Navigation\.ctaHref[\s\S]*[Mm]igrat|[Mm]igrat[\s\S]*Navigation\.ctaHref'
match: contains
matchExample: 'write a migration for Navigation.ctaHref that copies the existing value into the default locale before flipping the flag'
---

Two things have to appear together for the answer to be useful: the field actually
under discussion, and a migration as the path forward. Either alone is cheap —
naming the field is repeating the error message, and recommending "a migration"
without saying of what is advice that cannot be acted on.

Requiring them in either order avoids grading prose style. The pattern cannot tell
an answer that recommends a migration from one that mentions migrations while
suggesting the snapshot be deleted instead; that polarity is the LLM grader's job
on this case.
