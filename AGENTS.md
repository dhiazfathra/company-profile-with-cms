<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Every pull request carries its evidence

Run `bun run evidence` and append the contents of `e2e-evidence/pr-section.md` to
the pull request description. Append it — never overwrite what is already there,
including a report a tool wrote earlier.

This is not a formality. The reason this repository exists in its current shape is
that a homepage shipped with its hero rendered as a green band nested inside
another green band, and every automated check was green while it did. A green
check mark on a pull request tells a reviewer that some commands exited zero. It
does not tell them which commands, against what, or what those commands are
incapable of noticing. The evidence block does: the numbers, the command that
produced each one, how to reproduce it, and — the part reviewers actually need —
what the checks cannot see.

`bun run evidence` runs the gates itself (`test`, `lint`, `build`, the Playwright
e2e suite) and writes:

| Path                         | What it is                                                      |
| ---------------------------- | --------------------------------------------------------------- |
| `e2e-evidence/pr-section.md` | The block to append to the PR description                       |
| `e2e-evidence/report.html`   | Each section's render beside its Figma reference, plus the logs |
| `e2e-evidence/run.log`       | Raw output of every command, in order                           |

Three rules the script enforces so the pack cannot become theatre, and which you
must not work around:

- **Every figure is parsed out of the run's own output.** If a command fails, the
  script throws and writes nothing. Do not hand-edit a number into
  `pr-section.md`; regenerate it.
- **The checks are proven in both directions.** The script feeds deliberately
  broken fixtures to the eval suite's validator and fails if the validator accepts
  one, or rejects it for the wrong reason. A detector that has only seen clean
  input is not known to detect anything.
- **The "what this does not cover" section stays.** Deleting it turns a pass into a
  claim nobody made. If you add a check, add its blind spot too.

`e2e-evidence/` is ignored, so the pack is regenerated rather than committed.
Rationale and alternatives: [ADR-0011](docs/decisions/0011-evidence-pack-on-every-pr.md).
