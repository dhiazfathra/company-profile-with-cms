# ADR-0017: A second design language for the showcase, as a second file

## Status

Accepted

## Date

2026-08-22

## Context

`docs/showcase/index.html` is the build log written for a reader: one
dependency-free file, the narrative in one view and the technical record behind a
toggle. Its design language is dark — `#0b0c08` ground, two radial olive washes,
filled cards, a display serif — because it was derived from the site's own
palette (`--color-accent-1 #485c11`), inverted for a long document.

A second reading of the same document was asked for in the minimal language of
[albertosadde.com/fractional-cto](https://albertosadde.com/fractional-cto): paper
ground, one text colour, one link accent, hairlines instead of fills, and a single
narrow measure. Explicitly **not** replacing the existing page, and explicitly
without changing a word of it.

That combination — same content, different presentation, both kept — has three
possible shapes in a repository whose showcase is deliberately a single file with
no build step:

1. Two full files.
2. One file with two stylesheets and a switch.
3. A generator: content in one source, two templates, both files built.

The constraint that matters is the one the page already advertises about itself:
it is a static document with no build step, openable from disk. Anything that
turns it into a build output changes what the artefact is.

## Decision

**A second full file, `docs/showcase/v2.html`, whose document content is
byte-identical to `index.html`'s and whose `<head>` carries a different
stylesheet.**

The identity is not a convention, it is the mechanism: the body was copied
unmodified, and exactly two things were added to it afterwards — this variant's
theme button, and the script that drives it and builds the table-of-contents
rail. So the naive whole-body comparison is `False`, and the check that means
anything is the one that names those two additions and requires everything else
to match:

```text
$ cd docs/showcase && python3 - <<'PY'
import re
a = open('index.html').read(); b = open('v2.html').read()
body = lambda s: s[s.index('<body'):]
strip = lambda s: re.sub(r'\s*<button class="theme"[\s\S]*?</button>', '',
                 re.sub(r'\s*<script>\s*// ── Theme\.[\s\S]*?</script>', '', s))
print('whole body:            ', body(a) == body(b))
print('less the two additions:', strip(body(b)) == body(a))
PY
whole body:             False
less the two additions: True
```

A stricter reading of "unchanged content" than the diff, because it rejects a
reworded sentence as loudly as a deleted section.

Two consequences of that constraint shaped the stylesheet:

- **The token _names_ from `index.html` are kept.** The markup carries inline
  styles that call them (`style="margin-top: var(--s5)"`). Rebinding `--s5` is the
  redesign; renaming it would have been an edit to the document.
- **The SVGs are restyled from CSS, not edited.** The pipeline diagram and the
  header glyph carry their ink-on-olive palette as presentation attributes
  (`fill="#171a10"`, `stroke="#bcd873"`), and any CSS rule outranks a
  presentation attribute. So `.diagram svg g rect { fill: var(--paper) }` moves
  the whole diagram onto paper without touching a single node of its markup.

The rail is generated rather than written out, so the page still holds exactly
one list of its sections: the script reads the `id` and the `01 · Architecture`
eyebrow each section already carries.

## Alternatives considered

### One file, two stylesheets, a theme switch

- Pros: one copy of the content, so a correction cannot reach one reader and not
  the other. It is the obvious answer to "same content, two looks".
- Cons: the two languages are not two palettes, they are two layouts — a 1180px
  page with filled cards against a 680px measure with hairlines. Both rule sets
  would have to be present and neutralised for each other, and the neutralising
  is where the bugs live: a card padding that survives into the minimal view, a
  radial wash that outlives its theme. The page is 110KB of one document; making
  every rule conditional on a mode is a larger and more fragile change than a
  second stylesheet that starts from zero.
- Rejected.

### A generator: content once, two templates, both files built

- Pros: single source of truth, mechanically enforced.
- Cons: it makes the showcase a build output. The page's own claim is "open it in
  a browser — no build step, no dependencies", and it is the artefact people are
  pointed at. Introducing a generator to serve two hand-picked designs of one
  document is the kind of machinery this repository's ADR-0012 already declined
  in another form. Worth reconsidering the moment there is a third variant, or
  the moment the two files drift in a way a reader notices.
- Rejected for now.

### Replace `index.html`

- Pros: one file, no duplication, no drift.
- Cons: explicitly not what was asked. The dark version is the one linked from
  the README and from the deployment, and its language is derived from the
  product's palette; the minimal one is a different argument about the same
  material. Discarding the first to have the second answers a question nobody
  asked.
- Rejected.

## Consequences

- **The two files will drift, and nothing stops them.** This is the real cost and
  it is not mitigated: they are two hand-maintained copies, a correction to one
  will silently not reach the other, and the byte-identity verified at merge is a
  fact about this commit, not an invariant. The README says so in the paragraph
  that introduces the file. No gate enforces it, deliberately — a drift check
  comparing the two bodies would have to know which differences are intended (the
  theme button is one), and encoding that is more machinery than a two-file
  document earns. **If a third variant appears, or if the first correction misses
  a file, build the generator instead of adding a third copy.**
- **Neither file is covered by any fidelity check.** The design-fidelity suite
  grades `apps/web` against the Figma references; these documents are not in the
  manifest. The claim that v2 matches its reference language is a judgement about
  a third-party site, checked by eye, not a measurement — in the vocabulary of
  ADR-0011, this page has no check and therefore makes no verified claim about
  its own appearance.
- **The reference was read from the deployed stylesheet**, not a design file: the
  palette (`#fdfdfc`, `#21201c`, `#0073e6`), the fonts (Inter, JetBrains Mono) and
  the measure are the ones its CSS ships. Its behaviour in JavaScript, and below
  its own breakpoints, was not examined.
- **Dark mode in v2 has no reference and is derived.** `index.html` has no light
  mode and the reference site has no dark one, so v2's dark palette is an
  inversion in the same restrained language rather than a match to anything. The
  system preference is the default; an explicit click is stored and applied before
  first paint, so the wrong ground never renders first.
- **The CSS-over-presentation-attribute technique is reusable and worth
  remembering.** Any SVG in this repository that hardcodes palette colours as
  attributes can be rethemed from a stylesheet without editing the markup. The
  corollary is the warning: those attributes are _not_ a guarantee of appearance,
  so nothing should read a colour back out of them.
