/**
 * The chrome detector, tested in both directions.
 *
 * A detector that has only ever seen clean input is not known to detect anything.
 * Both assets that shipped Figma's interface did so past a *passing* fidelity
 * check, so every test here that asserts "clean input is accepted" is paired with
 * one that reproduces the actual bad artefact and asserts it is rejected.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  assertNoViewerChrome,
  cropRelative,
  cropToSelection,
  findSelection,
  findViewerChrome,
  healOutlines,
} from '../src/figma-crop.mjs'
import { INSTANCE_PURPLE, SELECTION_BLUE, badge, canvas, outline } from './fixtures.mjs'

let dir
const at = (name) => join(dir, name)

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'figma-to-site-'))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('findSelection', () => {
  it('returns the outline whose size matches the declared node size', async () => {
    // Two outlines in one capture: a 200x100 node and a 600x300 ancestor. Only the
    // declared size distinguishes them, which is the whole design and the whole
    // weakness of this function.
    const file = await canvas(at('two-outlines.png'), {
      width: 800,
      height: 500,
      rects: [
        ...outline({ x: 50, y: 50, w: 600, h: 300 }),
        ...outline({ x: 100, y: 100, w: 200, h: 100 }),
      ],
    })
    const box = await findSelection(file, { w: 100, h: 50, scale: 2 })
    expect([box.w, box.h]).toEqual([200, 100])
  })

  it('is not fooled by the dashed outline Figma draws on ancestor frames', async () => {
    // A dashed outline shatters into many small blobs. A naive min/max over
    // selection-coloured pixels would return their union — a box far larger than
    // any real node. Connected components is what makes this work.
    const dashes = []
    for (let x = 0; x < 700; x += 20) dashes.push({ x, y: 10, w: 8, h: 2, colour: SELECTION_BLUE })
    const file = await canvas(at('dashed.png'), {
      width: 800,
      height: 500,
      rects: [...dashes, ...outline({ x: 100, y: 100, w: 400, h: 200 })],
    })
    const box = await findSelection(file, { w: 200, h: 100, scale: 2 })
    expect([box.w, box.h]).toEqual([400, 200])
  })

  it('throws rather than guessing when no outline is present', async () => {
    const file = await canvas(at('blank.png'), { width: 200, height: 200 })
    await expect(findSelection(file, { w: 100, h: 100, scale: 2 })).rejects.toThrow(
      /no selection outline/,
    )
  })
})

describe('findViewerChrome', () => {
  it('accepts a design with no selection colour in it at all', async () => {
    const file = await canvas(at('clean.png'), {
      width: 400,
      height: 300,
      rects: [{ x: 20, y: 20, w: 100, h: 60, colour: { r: 200, g: 30, b: 30 } }],
    })
    expect(await findViewerChrome(file)).toEqual([])
  })

  it('ignores a stroke crossing the crop, which healOutlines is there to repair', async () => {
    // The purple instance outline that ran through the header laptop: one long
    // 2px line. Its bounding box is thin in one direction, so it is a stroke.
    const file = await canvas(at('stroke.png'), {
      width: 400,
      height: 300,
      rects: [{ x: 0, y: 150, w: 400, h: 2, colour: INSTANCE_PURPLE }],
    })
    expect(await findViewerChrome(file)).toEqual([])
  })

  it('rejects a complete selection rectangle caught inside a crop', async () => {
    // All four sides are one connected blob whose box is the node's whole bounds,
    // so this reports as chrome rather than as a repairable stroke. That is the
    // wanted answer: a crop containing a closed outline reached past its node.
    const file = await canvas(at('closed-outline.png'), {
      width: 400,
      height: 300,
      rects: outline({ x: 10, y: 10, w: 380, h: 280, strokeWidth: 2 }),
    })
    expect(await findViewerChrome(file)).toHaveLength(1)
  })

  it('rejects a dimension badge — the artefact that shipped into public/', async () => {
    // The real one: 237x34, at the bottom edge of a 2394x1400 crop. It scored 1.7
    // against a block-difference limit of 34, so the fidelity check passed and the
    // asset shipped. Size is the discriminator: a badge is tens of px in both
    // directions, a stroke is 1-2px in one of them however long it runs.
    const file = await canvas(at('badge.png'), {
      width: 600,
      height: 400,
      rects: badge({ x: 180, y: 350 }),
    })
    const blobs = await findViewerChrome(file)
    expect(blobs).toHaveLength(1)
    expect([blobs[0].w, blobs[0].h]).toEqual([237, 34])
  })

  it('rejects a purple component-instance badge as readily as a blue one', async () => {
    const file = await canvas(at('badge-purple.png'), {
      width: 600,
      height: 400,
      rects: badge({ x: 100, y: 100, colour: INSTANCE_PURPLE }),
    })
    expect(await findViewerChrome(file)).toHaveLength(1)
  })

  it('treats maxStrokeWidth as the stroke/chrome boundary', async () => {
    const file = await canvas(at('thick-stroke.png'), {
      width: 400,
      height: 300,
      rects: [{ x: 0, y: 100, w: 400, h: 12, colour: SELECTION_BLUE }],
    })
    expect(await findViewerChrome(file, { maxStrokeWidth: 20 })).toEqual([])
    expect((await findViewerChrome(file, { maxStrokeWidth: 8 })).length).toBeGreaterThan(0)
  })
})

describe('assertNoViewerChrome', () => {
  it('passes a clean crop', async () => {
    const file = await canvas(at('assert-clean.png'), { width: 200, height: 200 })
    await expect(assertNoViewerChrome(file)).resolves.toBeUndefined()
  })

  it('names the region and points at the real cause: a wrong declared size', async () => {
    const file = await canvas(at('assert-badge.png'), {
      width: 600,
      height: 400,
      rects: badge({ x: 180, y: 350 }),
    })
    // The message matters as much as the throw. A badge is a symptom — Figma
    // prints the node's real size inside it — so the error has to send the reader
    // to the declared size rather than to a paint-it-out workaround.
    await expect(assertNoViewerChrome(file)).rejects.toThrow(/237x34 at 180,350/)
    await expect(assertNoViewerChrome(file)).rejects.toThrow(/declared node size is wrong/)
  })
})

describe('healOutlines', () => {
  it('repaints a stroke drawn over the design, interpolating from its column', async () => {
    // A purple instance outline ran straight through the header laptop. Insetting
    // the crop escapes only the stroke on the node's own bounds, so strokes in the
    // middle have to be repainted.
    const width = 40
    const height = 20
    const channels = 3
    const buffer = Buffer.alloc(width * height * channels, 100)
    for (let x = 0; x < width; x++) {
      const o = (10 * width + x) * channels
      buffer[o] = INSTANCE_PURPLE.r
      buffer[o + 1] = INSTANCE_PURPLE.g
      buffer[o + 2] = INSTANCE_PURPLE.b
    }
    const found = await healOutlines(buffer, { width, height, channels })
    expect(found).toBe(width)
    const o = (10 * width + 20) * channels
    expect([buffer[o], buffer[o + 1], buffer[o + 2]]).toEqual([100, 100, 100])
  })

  it('reports zero and changes nothing when there is no stroke', async () => {
    const buffer = Buffer.alloc(10 * 10 * 3, 77)
    const before = Buffer.from(buffer)
    expect(await healOutlines(buffer, { width: 10, height: 10, channels: 3 })).toBe(0)
    expect(buffer.equals(before)).toBe(true)
  })
})

describe('cropToSelection', () => {
  it('crops inside the outline so no selection colour survives', async () => {
    const file = await canvas(at('crop-src.png'), {
      width: 800,
      height: 600,
      rects: outline({ x: 100, y: 100, w: 400, h: 200 }),
    })
    const out = at('crop-out.png')
    const { cw, ch } = await cropToSelection(file, out, { w: 200, h: 100, scale: 2 })
    expect([cw, ch]).toEqual([390, 190])
    // The point of the inset: the product of a crop must contain no viewer chrome.
    await expect(assertNoViewerChrome(out)).resolves.toBeUndefined()
  })

  it('corrects the height using the node aspect when a badge fuses onto the outline', async () => {
    // The badge sits just below the outline and can touch it, which merges the two
    // blobs and stretches the bounding box downward. The node's own aspect ratio
    // is the correction — without it the crop reaches past the node.
    const file = await canvas(at('fused.png'), {
      width: 800,
      height: 600,
      rects: [...outline({ x: 100, y: 100, w: 400, h: 200 }), ...badge({ x: 100, y: 300, w: 120, h: 30 })],
    })
    const { ch } = await cropToSelection(file, at('fused-out.png'), { w: 200, h: 100, scale: 2 })
    expect(ch).toBe(190)
  })
})

describe('cropRelative', () => {
  it('crops a design-px offset from a sibling outline', async () => {
    const file = await canvas(at('rel-src.png'), {
      width: 800,
      height: 600,
      rects: outline({ x: 100, y: 200, w: 400, h: 200 }),
    })
    const { cw, ch } = await cropRelative(file, at('rel-out.png'), {
      w: 200,
      h: 100,
      scale: 2,
      crop: { dx: 10, dy: -50, w: 150, h: 120 },
    })
    expect([cw, ch]).toEqual([300, 240])
  })

  it('throws instead of silently clamping when the offset leaves the capture', async () => {
    // Clamping here would return a smaller-but-plausible rectangle — exactly the
    // failure mode this package exists to prevent.
    const file = await canvas(at('rel-oob.png'), {
      width: 400,
      height: 300,
      rects: outline({ x: 10, y: 10, w: 200, h: 100 }),
    })
    await expect(
      cropRelative(file, at('rel-oob-out.png'), {
        w: 100,
        h: 50,
        scale: 2,
        crop: { dx: 0, dy: -100, w: 100, h: 100 },
      }),
    ).rejects.toThrow(/falls outside/)
  })
})
