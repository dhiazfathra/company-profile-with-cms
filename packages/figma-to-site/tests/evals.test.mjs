/**
 * The eval suite's own structure.
 *
 * `evals/` grades the *skill* — whether an agent reading SKILL.md reaches the
 * conclusions it was written to force — and it runs under `claude plugin eval`,
 * which is in early access. On a machine without access that command exits 1
 * before reading a single case, so a malformed grader or a case with no
 * assertions in it would sit there indefinitely looking like coverage.
 *
 * That is the failure this package exists to prevent, turned on the package's own
 * tests: a check nobody can run is not a check. So the suite's structure is
 * asserted here, in CI, on every push — the same reasoning that makes an empty
 * asset scan a failure rather than a pass.
 *
 * What this file does NOT do is run the evals. It cannot: they cost model calls
 * and need the early-access gate open. It asserts only that when the gate does
 * open, every case will load and every grader will assert something.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const EVALS = new URL('../evals/', import.meta.url).pathname

/**
 * The Figma file a case is put against, read out of the case's own prompt rather
 * than restated here. A second copy of a file key is a second thing to keep in
 * step with the design, and the prompt is the copy an agent actually sees.
 */
const figmaFileKey = (text) => /figma\.com\/design\/([A-Za-z0-9]+)\//.exec(text)?.[1]

const GRADER_TYPES = ['regex', 'tool_used', 'tool_order', 'file_exists', 'llm', 'baseline']
/** A grader that scores without a model, so a case cannot rest on judge prose alone. */
const DETERMINISTIC = ['regex', 'tool_used', 'tool_order', 'file_exists']
const REGEX_MATCHES = ['contains', 'not_contains']

/**
 * Enough YAML for the frontmatter these cases actually use: scalars, inline
 * lists, and single- or double-quoted strings. Deliberately not a YAML parser —
 * a case using something this cannot read is a case whose frontmatter should be
 * simplified, and the throw below says so rather than guessing at the value.
 */
function parseFrontmatter(text, where) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!match) throw new Error(`${where}: no YAML frontmatter delimited by --- lines`)
  const [, head, body] = match
  const fields = {}
  for (const line of head.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const kv = /^([A-Za-z_][A-Za-z0-9_]*): *(.*)$/.exec(line)
    if (!kv) throw new Error(`${where}: frontmatter line is not "key: value" — ${line}`)
    const [, key, raw] = kv
    fields[key] = parseScalar(raw.trim(), `${where}: ${key}`)
  }
  return { fields, body: body.trim() }
}

function parseScalar(raw, where) {
  if (raw.startsWith('[')) {
    if (!raw.endsWith(']')) throw new Error(`${where}: unterminated inline list`)
    const inner = raw.slice(1, -1).trim()
    return inner ? inner.split(',').map((v) => parseScalar(v.trim(), where)) : []
  }
  if (raw.startsWith("'")) {
    if (!raw.endsWith("'") || raw.length < 2) throw new Error(`${where}: unterminated quote`)
    return raw.slice(1, -1).replaceAll("''", "'")
  }
  if (raw.startsWith('"')) {
    if (!raw.endsWith('"') || raw.length < 2) throw new Error(`${where}: unterminated quote`)
    const inner = raw.slice(1, -1)
    if (/\\/.test(inner)) {
      // Backslash escapes in a double-quoted scalar mean this parser and YAML
      // would disagree about the value — and for a `pattern:` field the value is
      // a regular expression, where disagreeing by one backslash is the whole
      // meaning. Use single quotes, where nothing is escaped.
      throw new Error(`${where}: use single quotes for a value containing a backslash`)
    }
    return inner
  }
  if (/^-?\d+$/.test(raw)) return Number(raw)
  return raw
}

const dirsIn = (path) => readdirSync(path).filter((n) => statSync(join(path, n)).isDirectory())

const cases = dirsIn(EVALS).map((name) => {
  const dir = join(EVALS, name)
  const graderDir = join(dir, 'graders')
  return {
    name,
    dir,
    prompt: parseFrontmatter(readFileSync(join(dir, 'prompt.md'), 'utf8'), `${name}/prompt.md`),
    graders: readdirSync(graderDir)
      .filter((f) => f.endsWith('.md'))
      .map((file) => ({
        file: `${name}/graders/${file}`,
        ...parseFrontmatter(readFileSync(join(graderDir, file), 'utf8'), `${name}/graders/${file}`),
      })),
  }
})

describe('the eval suite', () => {
  // A suite of zero cases passes. Same rule as an empty asset scan and an empty
  // sections object: nothing to check is a failure, not a clean bill of health.
  it('has cases in it at all', () => {
    expect(cases.length).toBeGreaterThan(0)
  })

  it('puts a case against a real Figma file, and grades the answer on it', () => {
    // A scenario with no file behind it can be answered with generic design
    // advice. One case has to name a real file — and a grader has to hold the
    // answer to that file, or naming it was decoration.
    const withFile = cases
      .map((c) => ({ c, key: figmaFileKey(c.prompt.body) }))
      .filter(({ key }) => key)
    expect(
      withFile.map(({ c }) => c.name),
      'no case carries a figma.com file URL',
    ).not.toEqual([])
    for (const { c, key } of withFile) {
      const graded = c.graders.some((g) => String(g.fields.pattern ?? '').includes(key))
      expect(graded, `${c.name} names file ${key} but no grader checks the answer against it`).toBe(
        true,
      )
    }
  })

  it.each(cases.map((c) => [c.name, c]))('%s: prompt is loadable and self-describing', (_, c) => {
    expect(c.prompt.fields.name, 'name must match the directory').toBe(c.name)
    expect(c.prompt.fields.runs, 'runs must be a positive integer').toBeGreaterThan(0)
    expect(Array.isArray(c.prompt.fields.tags) && c.prompt.fields.tags.length).toBeTruthy()
    expect(c.prompt.body.length, 'the prompt body is the scenario').toBeGreaterThan(200)
  })

  it.each(cases.map((c) => [c.name, c]))('%s: asserts something without a judge', (_, c) => {
    // An LLM grader is a 2-of-3 vote on prose. A case resting on those alone can
    // drift with the judge model and nobody would see it move.
    const hard = c.graders.filter((g) => DETERMINISTIC.includes(g.fields.type))
    expect(
      hard.map((g) => g.file),
      'needs at least one deterministic grader',
    ).not.toEqual([])
  })

  it.each(cases.flatMap((c) => c.graders.map((g) => [g.file, g])))(
    '%s: is a well-formed grader',
    (_, g) => {
      expect(GRADER_TYPES).toContain(g.fields.type)
      // The body is the rubric a human reads when a grader fires. A grader with
      // no prose behind it is a number whose reason has been lost.
      expect(g.body.length, 'a grader states why it exists').toBeGreaterThan(80)
      if (g.fields.type === 'regex') {
        expect(REGEX_MATCHES).toContain(g.fields.match ?? 'contains')
        expect(
          () => new RegExp(g.fields.pattern),
          `pattern must compile: ${g.fields.pattern}`,
        ).not.toThrow()
      }
      if (g.fields.type === 'tool_used') expect(typeof g.fields.tool).toBe('string')
      if (g.fields.type === 'llm') expect(String(g.fields.criteria).length).toBeGreaterThan(40)
    },
  )
})
