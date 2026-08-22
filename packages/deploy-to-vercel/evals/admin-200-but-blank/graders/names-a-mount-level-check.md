---
type: regex
target: last_message
pattern: '(?=[\s\S]*(vercel logs|runtime log|browser console|console error|log in|sign in|load a collection|render(s|ed)? (the )?(panel|ui)|mount))(?=[\s\S]*(blank|empty page|white (screen|page)|fails? to (mount|render)|importMap|import map|client component))'
match: contains
matchExample: 'A 200 from /admin is the server shell; the panel can still fail to mount. Read `vercel logs` for an importMap error and log in to confirm a collection list renders.'
---

Naming the doubt without naming the instrument is the failure mode this
grader exists for: "a 200 might not mean much" is not a check. The answer has
to pair the specific symptom a status code cannot see — a blank page, a panel
that fails to mount, a missing client component or import-map entry — with a
concrete way to look for it: the deployment's runtime logs, the browser
console, or actually signing in and loading a collection. Either half alone
leaves the next person doing exactly what the prompt did.
