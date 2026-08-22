---
type: regex
target: last_message
pattern: '(?=[\s\S]*(?<!not )(?<!n''t )(?<!never )(?<!won''t )(?<!don''t )(?<!doesn''t )(curl|vercel logs|hit the (live )?url|check the (live|running) (app|site)))(?=[\s\S]*(200|status code|http.?code|renders|returns|confirm))'
match: contains
matchExample: 'curl the deployment root and confirm a 200, or check vercel logs for the actual runtime error'
---

The build log proves compilation succeeded, not that the running app can
reach its database. Naming an action alone ("check the logs") without saying
what result would count as passing is not a runtime check — it is a vague
gesture at one. The answer must name both a concrete action (curl the live
URL, read runtime logs) and what evidence from it would confirm the app
works (a `200`, rendered content, or an absence of a specific runtime error)
before this can be marked verified.
