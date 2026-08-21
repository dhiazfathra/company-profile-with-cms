/**
 * The two-axis fidelity check.
 *
 * Axis 1 (aspect, against a number read off the design) is the axis that catches
 * the whole class of bug this package exists for, so it is tested against a
 * *correct* render and a render with the specific defect that shipped: a section
 * whose padding doubled its whitespace and changed its shape.
 *
 * Axis 2 (coarse block colour) is tested for what it can and cannot see. Its
 * blindness to a small high-contrast intrusion is asserted deliberately — that
 * blindness is the documented reason the chrome detector has to exist separately,
 * and if a future change made block comparison fine-grained enough to catch a
 * badge, this test failing is the signal to revisit that reasoning.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ASPECT_TOLERANCE,
  BLOCK_TOLERANCE,
  checkSection,
  loadManifest,
} from '../src/design-check.mjs'
import { SELECTION_BLUE, badge, canvas } from './fixtures.mjs'

let dir
const at = (name) => join(dir, name)

const WHITE = { r: 255, g: 255, b: 255 }
const INK = { r: 30, g: 30, b: 30 }

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'figma-to-site-check-'))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

/** A section: white ground with a dark block of "content" in it. */
const section = (path, { width, height, content }) =>
  canvas(path, { width, height, background: WHITE, rects: [{ ...content, colour: INK }] })

describe('checkSection — axis 1, aspect ratio', () => {
  const spec = { size: [1200, 400], sizeFrom: 'figma-badge' }

  it('passes a render whose shape matches the design', async () => {
    const render = await section(at('ok.png'), {
      width: 2400,
      height: 800,
      content: { x: 100, y: 100, w: 600, h: 200 },
    })
    const result = await checkSection('Ok', spec, render, dir)
    expect(result.failures).toEqual([])
  })

  it('fails a section whose padding changed its shape, and says by how much', async () => {
    // The showcase defect: 96px of vertical padding where the design has 20px. The
    // copy is right, the colours are right, and the section is the wrong shape.
    const render = await section(at('padded.png'), {
      width: 2400,
      height: 1000,
      content: { x: 100, y: 200, w: 600, h: 200 },
    })
    const result = await checkSection('Padded', spec, render, dir)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toMatch(/aspect/)
    // The message must carry the design size and where that number came from, so
    // the reader can tell "the render is wrong" from "the manifest is wrong".
    expect(result.failures[0]).toMatch(/1200x400 \(figma-badge\)/)
  })

  it('tolerates a difference inside ASPECT_TOLERANCE', async () => {
    const nudged = Math.round(800 * (1 + ASPECT_TOLERANCE / 2))
    const render = await section(at('nudged.png'), {
      width: 2400,
      height: nudged,
      content: { x: 100, y: 100, w: 600, h: 200 },
    })
    const result = await checkSection('Nudged', spec, render, dir)
    expect(result.failures).toEqual([])
    expect(result.aspectDelta).toBeGreaterThan(0)
  })

  it('checks aspect even when the reference PNG is not trusted', async () => {
    // This is the axis that survives an untrustworthy screenshot: it compares
    // against a number taken from the design, so a bad reference cannot make it
    // lie — and must not be able to switch it off either.
    const render = await section(at('untrusted.png'), {
      width: 2400,
      height: 1600,
      content: { x: 10, y: 10, w: 100, h: 100 },
    })
    const result = await checkSection('Untrusted', spec, render, dir)
    expect(result.blockChecked).toBe(false)
    expect(result.failures).toHaveLength(1)
  })
})

describe('checkSection — axis 2, coarse block colour', () => {
  const size = [1200, 400]

  it('passes a render that differs from the reference only in fine detail', async () => {
    // Two renders of the same layout, one with its content nudged by a pixel. At a
    // 48-cell grid that is invisible, which is the point: font hinting and image
    // resampling must not fail a section.
    await section(at('Fine.png'), { width: 2400, height: 800, content: { x: 200, y: 200, w: 800, h: 300 } })
    const render = await section(at('fine-render.png'), {
      width: 2400,
      height: 800,
      content: { x: 201, y: 201, w: 800, h: 300 },
    })
    const result = await checkSection('Fine', { size, sizeFrom: 'reference', blockCheck: true }, render, dir)
    expect(result.failures).toEqual([])
    expect(result.block).toBeLessThan(BLOCK_TOLERANCE)
  })

  it('fails a render with the wrong background', async () => {
    await section(at('Bg.png'), { width: 2400, height: 800, content: { x: 200, y: 200, w: 800, h: 300 } })
    const render = await canvas(at('bg-render.png'), {
      width: 2400,
      height: 800,
      background: { r: 40, g: 90, b: 40 },
      rects: [{ x: 200, y: 200, w: 800, h: 300, colour: INK }],
    })
    const result = await checkSection('Bg', { size, sizeFrom: 'reference', blockCheck: true }, render, dir)
    expect(result.failures.join()).toMatch(/block difference/)
  })

  it('fails a render missing a whole element', async () => {
    await section(at('Missing.png'), {
      width: 2400,
      height: 800,
      content: { x: 200, y: 200, w: 1600, h: 400 },
    })
    const render = await canvas(at('missing-render.png'), {
      width: 2400,
      height: 800,
      background: WHITE,
    })
    const result = await checkSection('Missing', { size, sizeFrom: 'reference', blockCheck: true }, render, dir)
    expect(result.failures.join()).toMatch(/block difference/)
  })

  it('cannot see a dimension badge — which is why chrome has its own detector', async () => {
    // Asserting the blind spot on purpose. A 237x34 badge on a full-width section
    // scored 1.7 against a limit of 34. Tightening the block tolerance until this
    // failed would fail every honest section first; the answer is a separate,
    // size-based detector (see figma-crop.test.mjs).
    await section(at('Blind.png'), { width: 2400, height: 800, content: { x: 200, y: 200, w: 1600, h: 300 } })
    const render = await canvas(at('blind-render.png'), {
      width: 2400,
      height: 800,
      background: WHITE,
      rects: [
        { x: 200, y: 200, w: 1600, h: 300, colour: INK },
        ...badge({ x: 1000, y: 740, colour: SELECTION_BLUE }),
      ],
    })
    const result = await checkSection('Blind', { size, sizeFrom: 'reference', blockCheck: true }, render, dir)
    expect(result.failures).toEqual([])
    expect(result.block).toBeLessThan(5)
  })

  it('fails loudly when the manifest claims a reference that is not on disk', async () => {
    // Not "skip the check": a manifest that vouches for a missing file is a broken
    // manifest, and treating it as an absent check is how a gate becomes theatre.
    const render = await section(at('gone-render.png'), {
      width: 2400,
      height: 800,
      content: { x: 200, y: 200, w: 800, h: 300 },
    })
    const result = await checkSection('Gone', { size, sizeFrom: 'reference', blockCheck: true }, render, dir)
    expect(result.failures.join()).toMatch(/enables the content check but .* is missing/)
  })
})

describe('loadManifest', () => {
  const write = async (name, manifest) => {
    const sub = join(dir, name)
    await rm(sub, { recursive: true, force: true })
    await import('node:fs/promises').then((fs) => fs.mkdir(sub, { recursive: true }))
    await writeFile(join(sub, 'refs.json'), JSON.stringify(manifest))
    return sub
  }

  it('returns the manifest with the refs dir attached', async () => {
    const sub = await write('good', {
      designWidth: 1200,
      sections: { Header: { size: [1200, 738], sizeFrom: 'reference', blockCheck: true } },
    })
    const manifest = loadManifest(sub)
    expect(manifest.refsDir).toBe(sub)
    expect(manifest.sections.Header.size).toEqual([1200, 738])
  })

  it('rejects a section with no size', async () => {
    const sub = await write('nosize', { sections: { Header: { sizeFrom: 'reference' } } })
    expect(() => loadManifest(sub)).toThrow(/size must be \[width, height\]/)
  })

  it('rejects a section that does not say where its size came from', async () => {
    // `sizeFrom` is what makes a size trustworthy: a number off a Figma badge
    // outranks one derived from a screenshot's own aspect. A size with no
    // provenance is a number nobody has vouched for.
    const sub = await write('noprov', { sections: { Header: { size: [1200, 738] } } })
    expect(() => loadManifest(sub)).toThrow(/needs sizeFrom/)
  })

  it('rejects a manifest with no sections at all', async () => {
    const sub = await write('empty', { designWidth: 1200 })
    expect(() => loadManifest(sub)).toThrow(/no "sections" object/)
  })

  it('rejects a sections array, which would silently check nothing', async () => {
    const sub = await write('arr', { sections: [{ size: [1200, 738], sizeFrom: 'reference' }] })
    expect(() => loadManifest(sub)).toThrow(/no "sections" object/)
  })

  it('rejects an empty sections object rather than generating zero checks', async () => {
    // Zero checks pass. A manifest that names no section turns the whole gate
    // into a green no-op, which is the exact failure this package exists for.
    const sub = await write('none', { sections: {} })
    expect(() => loadManifest(sub)).toThrow(/nothing would be checked/)
  })

  it('ignores a refsDir written into the file, keeping the caller authoritative', async () => {
    // Two entry points load this manifest — the CLI with its own path, the
    // Playwright spec with the project's. A refsDir in the file would let them
    // compare renders against different reference directories.
    const sub = await write('override', {
      refsDir: '/somewhere/else',
      sections: { Header: { size: [1200, 738], sizeFrom: 'reference' } },
    })
    expect(loadManifest(sub).refsDir).toBe(sub)
  })
})
