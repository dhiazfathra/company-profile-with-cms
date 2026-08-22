---
type: llm
criteria: 'Does the answer refuse to build the requested `--stdin-filepath` or Prettier-API workaround before the glob theory is actually reproduced — asking for the command run with its exit code from a confirmed working directory, and pointing out that the reported symptom is equally explained by running the check from the wrong directory (where the path genuinely does not exist)? Does it identify the far more likely real cause: the generator writes the file in a style the repository config rejects, so it is legitimately unformatted the instant it is created, meaning the gate is reporting a true violation? Does it prescribe adding the generated file to `.prettierignore` (or equivalent) because generated output belongs to its generator, rather than formatting it by hand — which the next build undoes?'
focus: 'Refusing to act on an unverified diagnosis, and reaching the real cause. An answer that implements --stdin-filepath as asked fails, however well engineered. An answer that lands on ignoring the generated file for the right reason passes even if it is gentler than it should be about the four --no-verify commits.'
---

This case is drawn from a mistake made in this repository, and the diagnosis in
the prompt is the mistake, stated confidently and already written into four commit
messages. When it was finally tested, Prettier resolved the parenthesised path
correctly from both the repository root and the app directory, found the file, and
reported the same real formatting violation from either. The supporting "evidence"
had been a command run from a shell sitting in the wrong directory.

The judgement under test is therefore not about Prettier. It is: a tool reporting
something inconvenient is not evidence the tool is wrong, and the suspicion should
rise, not fall, when the proposed workaround amounts to switching the check off.

A correct answer asks for the reproduction first. The second half — generated
output belongs to its generator, so ignore it rather than format it — is the fix
that actually holds, because hand-formatting loses to the next build every time.
