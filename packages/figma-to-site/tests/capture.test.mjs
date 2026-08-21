/**
 * Config validation and the committed-asset scan.
 *
 * `validateConfig` cannot verify that a declared node size is *right* — nothing
 * static can, which is the premise of the whole package. What it can do is refuse
 * the shapes that guarantee a wrong crop: a missing size, a zero size, a duplicate
 * target name silently overwriting another's output.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { validateConfig } from '../src/capture.mjs'
import { scanAssets } from '../src/scan-assets.mjs'
import { SELECTION_BLUE, badge, canvas, outline } from './fixtures.mjs'

let dir
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'figma-to-site-capture-'))
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

const target = (over = {}) => ({ name: 'Header', node: '1-122', w: 1200, h: 362, out: 'a.png', ...over })

describe('validateConfig', () => {
  it('accepts a complete config', () => {
    expect(validateConfig({ fileKey: 'abc', targets: [target()] })).toEqual([])
  })

  it('requires a file key', () => {
    expect(validateConfig({ targets: [target()] }).join()).toMatch(/fileKey is required/)
  })

  it('requires a non-empty targets array', () => {
    expect(validateConfig({ fileKey: 'abc' }).join()).toMatch(/non-empty array/)
    expect(validateConfig({ fileKey: 'abc', targets: [] }).join()).toMatch(/non-empty array/)
  })

  it('requires a positive width and height on every target', () => {
    // A missing or zero size does not make the crop fail — it makes the matcher
    // score every candidate outline against nothing and return the first one.
    expect(validateConfig({ fileKey: 'a', targets: [target({ w: undefined })] }).join()).toMatch(/w must be/)
    expect(validateConfig({ fileKey: 'a', targets: [target({ h: 0 })] }).join()).toMatch(/h must be/)
  })

  it('rejects duplicate target names', () => {
    const problems = validateConfig({ fileKey: 'a', targets: [target(), target()] })
    expect(problems.join()).toMatch(/duplicate name/)
  })

  it('rejects a malformed relative crop', () => {
    const bad = target({ crop: { dx: 10, dy: 'up', w: 100, h: 100 } })
    expect(validateConfig({ fileKey: 'a', targets: [bad] }).join()).toMatch(/numeric dx, dy/)
  })

  it('rejects a non-object target instead of crashing on property access', () => {
    // `targets: [null]` used to throw a TypeError out of the validator itself,
    // so the caller got a stack trace where it had asked for a problem list.
    for (const bad of [null, 'Header', 42, ['Header']]) {
      expect(validateConfig({ fileKey: 'a', targets: [bad] }).join()).toMatch(/must be an object/)
    }
  })

  it('requires name, node and out to be non-empty strings', () => {
    // A truthy non-string `out` passed validation and failed much later, inside
    // the browser run, as a path error.
    expect(validateConfig({ fileKey: 'a', targets: [target({ out: 1 })] }).join()).toMatch(/out is required/)
    expect(validateConfig({ fileKey: 'a', targets: [target({ node: {} })] }).join()).toMatch(/node is required/)
    expect(validateConfig({ fileKey: 'a', targets: [target({ name: 7 })] }).join()).toMatch(/name is required/)
  })

  it('reports every problem at once rather than the first', () => {
    // A capture run is slow and needs a real browser window. Failing on one
    // problem at a time turns a five-minute fix into five runs.
    const problems = validateConfig({ targets: [target({ name: undefined, w: undefined })] })
    expect(problems.length).toBeGreaterThan(2)
  })
})

describe('scanAssets', () => {
  it('reports a clean tree as clean', async () => {
    const clean = join(dir, 'clean')
    await mkdir(clean, { recursive: true })
    await canvas(join(clean, 'hero.png'), { width: 80, height: 60 })
    const scan = await scanAssets([clean])
    expect(scan.contaminated).toEqual([])
    expect(scan.empty).toEqual([])
    expect(scan.scanned).toHaveLength(1)
  })

  it('names the file and the region when an asset carries a badge', async () => {
    const dirty = join(dir, 'dirty')
    await mkdir(dirty, { recursive: true })
    await canvas(join(dirty, 'ok.png'), { width: 80, height: 60 })
    await canvas(join(dirty, 'showcase.png'), { width: 600, height: 400, rects: badge({ x: 180, y: 350 }) })
    const scan = await scanAssets([dirty])
    expect(scan.contaminated).toHaveLength(1)
    expect(scan.contaminated[0]).toMatch(/showcase\.png: 1 region\(s\) — 237x34@180,350/)
  })

  it('does not flag a thin selection stroke that healOutlines would repair', async () => {
    const strokes = join(dir, 'strokes')
    await mkdir(strokes, { recursive: true })
    await canvas(join(strokes, 'edge.png'), {
      width: 300,
      height: 200,
      rects: [{ x: 0, y: 90, w: 300, h: 2, colour: SELECTION_BLUE }],
    })
    expect((await scanAssets([strokes])).contaminated).toEqual([])
  })

  it('flags an asset carrying a whole selection rectangle', async () => {
    const framed = join(dir, 'framed')
    await mkdir(framed, { recursive: true })
    await canvas(join(framed, 'over-cropped.png'), {
      width: 300,
      height: 200,
      rects: outline({ x: 5, y: 5, w: 290, h: 190, strokeWidth: 2 }),
    })
    expect((await scanAssets([framed])).contaminated).toHaveLength(1)
  })

  it('scans nested directories, not just the top level', async () => {
    // A shallow scan called a tree clean when the contaminated image sat one
    // directory down — the guardrail passing on exactly the file it exists for.
    const nested = join(dir, 'nested')
    const deep = join(nested, 'icons')
    await mkdir(deep, { recursive: true })
    await canvas(join(nested, 'clean.png'), { width: 80, height: 60 })
    await canvas(join(deep, 'badged.png'), {
      width: 300,
      height: 200,
      rects: badge({ x: 30, y: 60 }),
    })
    const scan = await scanAssets([nested])
    expect(scan.scanned).toHaveLength(2)
    expect(scan.contaminated.join()).toMatch(/icons\/badged\.png/)
  })

  it('reports a directory with no images instead of passing silently', async () => {
    // A scan that found nothing to scan is not a clean scan. This is the easiest
    // way for the guardrail to become a no-op: point it at a moved directory and
    // it goes green forever.
    const bare = join(dir, 'bare')
    await mkdir(bare, { recursive: true })
    await writeFile(join(bare, 'README.md'), 'not an image')
    const scan = await scanAssets([bare])
    expect(scan.empty).toEqual([bare])
    expect(scan.scanned).toEqual([])
  })
})
