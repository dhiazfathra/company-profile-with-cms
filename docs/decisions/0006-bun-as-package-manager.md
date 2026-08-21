# ADR-0006: Bun as package manager and script runner; Node.js as the runtime

## Status
Accepted

## Date
2026-08-21

## Context
The project needs a package manager and a script runner. Two decisions hide
inside that one choice, and they carry very different risk:

1. **Which tool installs dependencies and runs scripts** — a development-time
   concern, reversible by deleting a lockfile.
2. **Which runtime executes the application** — a production concern that
   determines whether every dependency's native and Node-API surface works.

Conflating them is the trap. Bun is both a package manager and a JavaScript
runtime, and adopting it as the former is frequently mistaken for adopting it as
the latter.

Two facts constrain the decision:

- **Payload** requires Node.js 20.9.0+ and lists supported package managers as
  "pnpm, npm, or yarn 2+", with pnpm preferred and yarn 1.x unsupported. Bun is
  not mentioned — neither endorsed nor excluded.
- **Vercel** detects Bun 1 from `bun.lockb` or `bun.lock` and installs with
  `bun install` (text lockfile via `bun install` on Bun ≥1.2). Serverless
  functions still execute on the Node.js runtime; Bun is not a function runtime
  on Vercel.

## Decision
Use Bun for dependency installation and script running: `bun install`,
`bun run <script>`. Commit `bun.lock` (text format, Bun ≥1.2).

Run the application on **Node.js 20.9.0+** — in development via the Next.js dev
server, in production via Vercel's Node runtime. Do not run Next.js or Payload
under the Bun runtime (`bun --bun next dev`).

Scripts are invoked as `bun run test`, not `bun test`. Bare `bun test` invokes
Bun's own test runner and ignores the `package.json` script; `bun run` executes
what is actually configured.

## Alternatives Considered

### pnpm — Payload's documented preference
- Pros: explicitly supported and preferred by Payload, so any dependency
  resolution bug is a supported configuration with a place to report it. Strict
  by default: its non-flat `node_modules` prevents accidental reliance on
  undeclared transitive dependencies. Content-addressed store gives most of the
  disk and install-time benefit people reach for Bun to get.
- Cons: slower than Bun on cold installs, though the gap is far smaller against
  a warm store than benchmark headlines imply. A second tool if Bun is already
  the team's runner elsewhere.
- Rejected: the honest reason is preference, not evidence — Bun's install speed
  and single-binary toolchain won on ergonomics. **This is the alternative to
  return to** if Bun causes a Payload install or resolution problem, because it
  is the configuration Payload actually tests against.

### npm
- Pros: universally present; zero adoption cost.
- Cons: Payload's own docs note npm may require `--legacy-peer-deps` — a
  standing papercut, and a flag that suppresses real peer-dependency conflicts
  rather than resolving them. Slowest of the options.
- Rejected: strictly worse than both alternatives above for this stack.

### yarn 2+
- Pros: supported by Payload; Plug'n'Play offers strong install performance.
- Cons: PnP breaks tools that expect a real `node_modules` layout — a live risk
  with Payload's admin bundling and Next.js build tooling. Mitigating it means
  `nodeLinker: node-modules`, which discards the reason to choose yarn.
- Rejected: complexity without a corresponding gain here.

### Bun as the application runtime, not just the package manager
- Pros: one binary for install, run, test, and bundle; fast startup; native
  TypeScript execution without a transpile step in scripts.
- Cons: Payload requires Node 20.9.0+ and does not list Bun as a supported
  runtime — running under it puts the project outside every configuration its
  maintainers test. Vercel executes functions on Node regardless, so production
  would run a different runtime than development: the exact split that produces
  bugs reproducible in only one environment. Payload's Postgres adapter and
  `sharp` are native-addon paths where runtime differences surface first.
- Rejected: this is where the real risk lives, and it buys nothing the project
  needs. Rejecting it is what makes accepting Bun as a package manager cheap.

## Consequences
- `bun.lock` is committed; Vercel infers Bun from it with no `installCommand`
  override needed.
- `engines.node` is pinned to `>=20.9.0` in `package.json` to match Payload's
  floor, and the Vercel project's Node version is set accordingly.
- **Bun is off Payload's supported matrix as a package manager.** If an install
  or peer-resolution failure appears that reproduces under `bun install` but not
  `pnpm install`, the fix is to switch, not to debug — see the pnpm entry above.
  This is the trigger to supersede this ADR.
- Scripts must be written runtime-agnostically: no Bun-only globals
  (`Bun.file`, `Bun.serve`) in `gen:cms` or `seed`, since those also run in CI
  and on Vercel's Node build step.
- The generators and tests do not depend on Bun; switching package managers is a
  lockfile change, which is what keeps this decision cheap to reverse.

## Revisit When
- Payload lists Bun among its supported package managers or runtimes.
- Vercel offers Bun as a function runtime for Next.js.
- Any install-time failure that does not reproduce under pnpm.
