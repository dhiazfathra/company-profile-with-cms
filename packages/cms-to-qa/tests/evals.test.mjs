/**
 * The eval suite's own structure.
 *
 * `evals/` grades the *skill* — whether an agent reading SKILL.md reaches the
 * conclusions it was written to force — and it runs under `claude plugin eval`,
 * which is in early access. On a machine without access that command exits 1
 * before reading a single case, so a malformed grader or a case with no
 * assertions in it would sit there indefinitely looking like coverage.
 *
 * This file is deliberately a near-twin of
 * `packages/site-to-cms/tests/evals.test.mjs`, which is itself a near-twin of
 * `packages/figma-to-site/tests/evals.test.mjs`. The duplication is the cheaper
 * side of a trade, and it is the same trade each time: a shared harness would
 * couple three suites' frontmatter conventions together, so tightening a rule for
 * one skill's cases would silently retune the other two — and the assertion that
 * matters most is the one that differs. There it is that a case is put against a
 * real Figma file; in `site-to-cms` and here, that a case is put against a field
 * that really exists in the content manifest, because a scenario about an evidence
 * pack with no content model behind it can be answered with generic QA advice.
 *
 * Extracting the shared 90% would also leave the differing 10% in a subclass hook
 * nobody reads, which is the wrong place for the only assertion in the file that
 * is about this skill.
 *
 * What this file does NOT do is run the evals. It cannot: they cost model calls
 * and need the early-access gate open. It asserts only that when the gate does
 * open, every case will load and every grader will assert something.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// fileURLToPath, not `.pathname`: the latter keeps percent-encoding (a directory
// with a space arrives as `%20`) and on Windows yields a leading-slash path that
// `join` cannot use. Both failures are in the path handling rather than in
// anything this file is testing, so they would read as a broken suite.
const EVALS = fileURLToPath(new URL('../evals/', import.meta.url))

/**
 * The consuming app's content manifest — the authority for what fields exist.
 * Resolved rather than restated: a second copy of a field list is a second thing
 * to keep in step with the schema.
 *
 * If this path ever stops resolving, that is a failure and not a skip. A suite
 * whose reality check quietly stops running is the exact shape of defect this
 * skill exists to prevent, so `names-a-real-field` asserts the file is there.
 */
const MANIFEST = fileURLToPath(new URL('../../../apps/web/site.manifest.json', import.meta.url))

/** `Section.field` references, as they appear in a case's prose. */
const fieldRefs = (text) => [...text.matchAll(/\b([A-Z][A-Za-z0-9]*)\.([a-z][A-Za-z0-9]*)\b/g)]

const GRADER_TYPES = ['regex', 'tool_used', 'tool_order', 'file_exists', 'llm', 'baseline']
/** A grader that scores without a model, so a case cannot rest on judge prose alone. */
const DETERMINISTIC = ['regex', 'tool_used', 'tool_order', 'file_exists']
const REGEX_MATCHES = ['contains', 'not_contains']

/**
 * Enough YAML for the frontmatter these cases actually use: scalars, inline and
 * block lists, and single- or double-quoted strings. Deliberately not a YAML parser —
 * a case using something this cannot read is a case whose frontmatter should be
 * simplified, and the throw below says so rather than guessing at the value.
 */
function parseFrontmatter(text, where) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!match) throw new Error(`${where}: no YAML frontmatter delimited by --- lines`)
  const [, head, body] = match
  const fields = {}
  let last = null
  for (const line of head.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    // Block lists, because the inline form splits on commas and these values are
    // sentences. The `- ` items belong to the key above them, which must have
    // opened the list by giving no value of its own.
    const item = /^\s*- +(.*)$/.exec(line)
    if (item) {
      if (!last || !Array.isArray(fields[last])) {
        throw new Error(`${where}: list item with no key above it — ${line}`)
      }
      fields[last].push(parseScalar(item[1].trim(), `${where}: ${last}`))
      continue
    }
    const kv = /^([A-Za-z_][A-Za-z0-9_]*): *(.*)$/.exec(line)
    if (!kv) throw new Error(`${where}: frontmatter line is not "key: value" — ${line}`)
    const [, key, raw] = kv
    last = key
    fields[key] = raw.trim() === '' ? [] : parseScalar(raw.trim(), `${where}: ${key}`)
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
  // A suite of zero cases passes. Same rule as an empty asset scan: nothing to
  // check is a failure, not a clean bill of health.
  it('has cases in it at all', () => {
    expect(cases.length).toBeGreaterThan(0)
  })

  it('puts a case against a field that really exists, and grades the answer on it', () => {
    // A scenario with no real content model behind it can be answered with
    // generic QA advice: "investigate the failure", "do not fake evidence". The
    // judgements this skill forces are about a specific field in a specific
    // report section, so at least one case has to name a field the consuming app
    // actually has — and a grader has to hold the answer to that field, or
    // naming it was decoration.
    expect(existsSync(MANIFEST), `the content manifest is not at ${MANIFEST}`).toBe(true)
    const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
    const real = new Set(
      manifest.sections.flatMap((s) => s.fields.map((f) => `${s.name}.${f.name}`)),
    )
    expect(real.size, 'the manifest declares no fields').toBeGreaterThan(0)

    const named = cases.map((c) => ({
      c,
      fields: fieldRefs(c.prompt.body)
        .map(([ref]) => ref)
        .filter((ref) => real.has(ref)),
    }))
    expect(
      named.filter(({ fields }) => fields.length).map(({ c }) => c.name),
      'no case names a field from the content manifest',
    ).not.toEqual([])

    // At least one case must be *graded* against a real field, not merely
    // mention one. Deliberately not a per-case rule: unlike a Figma file URL,
    // a `Section.field` reference is ordinary scenario detail and shows up in
    // prompts whose judgement has nothing to do with that field. Requiring a
    // grader for each would mean bolting irrelevant field names into patterns
    // that are about something else — the check would start degrading the
    // graders it exists to keep honest.
    // Compared against the pattern with its escapes removed. A grader writes
    // the field as `Navigation\.ctaHref`, so a plain substring test misses it
    // over one backslash — and testing the compiled regex against the bare
    // field name fails too, because such a pattern deliberately requires more
    // than the field (there, a migration as well). Only the backslash before a
    // non-alphanumeric is dropped, so `[\s\S]` and friends survive intact.
    const unescape = (pattern) => pattern.replace(/\\(?=[^A-Za-z0-9])/g, '')
    const graded = named.filter(({ c, fields }) =>
      c.graders.some(
        (g) =>
          typeof g.fields.pattern === 'string' &&
          fields.some((ref) => unescape(g.fields.pattern).includes(ref)),
      ),
    )
    expect(
      graded.map(({ c }) => c.name),
      'no grader holds an answer to a field that really exists — the manifest references are decoration',
    ).not.toEqual([])
  })

  it.each(cases.map((c) => [c.name, c]))('%s: prompt is loadable and self-describing', (_, c) => {
    expect(c.prompt.fields.name, 'name must match the directory').toBe(c.name)
    expect(c.prompt.fields.runs, 'runs must be a positive integer').toBeGreaterThan(0)
    expect(Array.isArray(c.prompt.fields.tags) && c.prompt.fields.tags.length).toBeTruthy()
    // Every case here is a pure reasoning case. A case that quietly acquires a
    // tool is a different kind of eval — it could satisfy a grader by going and
    // reading this repository instead of by knowing what the skill teaches.
    expect(c.prompt.fields.allowed_tools, 'a case must declare itself tool-free').toEqual([])
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

  it.each(cases.map((c) => [c.name, c]))('%s: carries a judged grader too', (_, c) => {
    // The mirror of the rule above, and the reason this suite can afford loose
    // regexes: every requirement that turns on *direction* — refuse the bypass,
    // reject both offered options, do not act on an unverified diagnosis — is
    // unreadable by a keyword match. A case with no LLM grader has quietly
    // dropped its polarity requirements.
    const judged = c.graders.filter((g) => g.fields.type === 'llm')
    expect(
      judged.map((g) => g.file),
      'needs at least one llm grader to carry the direction-sensitive requirements',
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
        // `new RegExp(undefined)` and `new RegExp('')` both compile, so a grader
        // that forgot its pattern would sail through the checks below.
        expect(typeof g.fields.pattern, 'a regex grader needs a pattern').toBe('string')
        expect(g.fields.pattern.length, 'the pattern must not be empty').toBeGreaterThan(0)
        expect(REGEX_MATCHES).toContain(g.fields.match ?? 'contains')
        expect(
          () => new RegExp(g.fields.pattern),
          `pattern must compile: ${g.fields.pattern}`,
        ).not.toThrow()
        // A pattern that matches an empty string grades a blank answer as a pass —
        // the deterministic grader would assert nothing at all.
        const re = new RegExp(g.fields.pattern)
        expect(
          re.test(''),
          `pattern matches empty string, too permissive: ${g.fields.pattern}`,
        ).toBe(false)
        // And the opposite failure: `(?!)` compiles, matches no empty string, and
        // matches nothing else either — a `contains` grader that can never pass.
        // Neither direction is visible from the pattern alone, so every regex
        // grader carries one fragment of a correct answer that it must match. The
        // fixture doubles as documentation of what the pattern is looking for.
        expect(
          typeof g.fields.matchExample,
          'a regex grader needs a matchExample: a fragment of a correct answer',
        ).toBe('string')
        // `matchExample` means "a fragment of a CORRECT answer", so what the
        // pattern must do with it depends on the grader's direction. Under
        // `contains` a correct answer matches; under `not_contains` the grader
        // passes when the pattern is absent, so a correct answer must NOT match —
        // asserting `true` there would demand an example that fails the grader.
        // Checked explicitly rather than assumed, because `match` defaults to
        // `contains` and a `not_contains` grader would otherwise be validated
        // backwards without anything saying so.
        const isNegated = (g.fields.match ?? 'contains') === 'not_contains'
        expect(
          re.test(g.fields.matchExample),
          isNegated
            ? `not_contains pattern matches its own matchExample — the example is a ` +
                `fragment of a correct answer, so the grader would reject it:\n` +
                `  pattern: ${g.fields.pattern}\n  example: ${g.fields.matchExample}`
            : `pattern does not match its own matchExample — it may match nothing at all:\n` +
                `  pattern: ${g.fields.pattern}\n  example: ${g.fields.matchExample}`,
        ).toBe(!isNegated)
        // Optional, and the only guard against the failure a matchExample cannot
        // see: a pattern loose enough to match an answer that is wrong. The gap-list
        // grader accepted "we preserved the original report" — the refusal verb with
        // no mention of what was protected — and then "keep the old report, but delete
        // the Not Covered section", which names the artefact while assisting the
        // removal. Singular and plural are both read, so one wrong answer needs no list.
        // A declared-but-empty list would assert nothing, and the frontmatter
        // parser silently dropping its items looks exactly like a grader that
        // never had any — the same hole as a header rename in the workbook tests.
        if (g.fields.nonMatchExamples !== undefined) {
          expect(
            Array.isArray(g.fields.nonMatchExamples) && g.fields.nonMatchExamples.length > 0,
            'nonMatchExamples is declared but empty — nothing would be asserted',
          ).toBe(true)
        }
        for (const wrong of [g.fields.nonMatchExample, ...(g.fields.nonMatchExamples ?? [])]) {
          if (wrong === undefined) continue
          expect(
            typeof wrong,
            'a nonMatchExample must be a string: a fragment of a WRONG answer',
          ).toBe('string')
          expect(
            re.test(wrong),
            `pattern matches a nonMatchExample — it accepts an answer it must reject:\n` +
              `  pattern: ${g.fields.pattern}\n  example: ${wrong}`,
          ).toBe(isNegated)
        }
      }
      if (g.fields.type === 'tool_used') expect(typeof g.fields.tool).toBe('string')
      if (g.fields.type === 'llm') expect(String(g.fields.criteria).length).toBeGreaterThan(40)
    },
  )
})
