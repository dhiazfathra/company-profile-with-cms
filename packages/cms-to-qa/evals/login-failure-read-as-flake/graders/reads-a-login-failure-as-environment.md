---
type: llm
criteria: 'Does the answer reject the flaky-first-case reading and identify a failing login rather than a timing problem — pointing at the "The email or password provided is incorrect." message as a server response that a warm-up delay cannot produce? Does it explain the reporting artefact: a login failure in beforeAll is attributed by Playwright to the first test, so it looks like one failing case and is actually a database whose editor account no longer matches the credentials in apps/web/.env? Does it prescribe checking those credentials against the seeded account and reseeding before any rerun, and refuse to generate a pack from a longer timeout — noting the report would say nothing about any field?'
focus: 'Reading the assertion message instead of the failure count. An answer that raises the timeout, or that treats the 13 "did not run" cases as skipped collateral needing no explanation, fails.'
---

The counts in this run are shaped exactly like one bad case, and they are produced
by a prerequisite that was never met. This was one of the three misread failures
found while building the runner, and it is the least obvious of them because
Playwright's attribution actively points at the wrong thing.

The message is decisive on its own: an incorrect-credentials response came back
from the server, so the panel was reachable and the account was not. Nothing about
a warming dev server produces that string. Read the assertion message first.
