---
type: regex
target: last_message
pattern: '(reseed|re-seed|seed the database|run --cwd apps/web seed|seeded editor|editor account|\.env)'
match: contains
matchExample: 'the seeded editor account does not match E2E_USER_EMAIL in apps/web/.env — reseed before rerunning'
---

The corrective action is environmental: the credentials in `.env` and the seeded
editor account disagree, so the fix lives in the database or the env file and not
in a timeout. An answer that tunes the navigation timeout and reruns will not
reach this vocabulary. Accepted in several phrasings because the answer may name
the seed command, the env file, or the account mismatch itself.
