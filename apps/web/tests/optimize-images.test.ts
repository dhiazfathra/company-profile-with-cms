import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { optimize } from '@/scripts/optimize-images'

/**
 * A fixture that is genuinely wasteful in the way the seeded assets were:
 * 24-bit truecolour holding a handful of distinct colours, large enough to
 * clear the script's size floor.
 */
async function wastefulPng(file: string) {
  const width = 1400
  const height = 1000
  const pixels = Buffer.alloc(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    const band = Math.floor((i % width) / 200) % 4
    pixels[i * 3] = band * 60
    pixels[i * 3 + 1] = 40 + band * 20
    pixels[i * 3 + 2] = 200 - band * 30
  }
  const png = await sharp(pixels, { raw: { width, height, channels: 3 } })
    .png({ palette: false, compressionLevel: 0 })
    .toBuffer()
  await writeFile(file, png)
  return png.length
}

let dir: string
let originalSize: number

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'optimize-images-'))
  originalSize = await wastefulPng(path.join(dir, 'big.png'))
  // Under the 100KB floor: quantization noise there is worth more than the
  // bytes, so the script must leave it alone.
  await writeFile(
    path.join(dir, 'small.png'),
    await sharp(path.join(dir, 'big.png')).resize(24).png().toBuffer(),
  )
}, 60_000)

afterAll(async () => {
  await import('node:fs/promises').then((fs) => fs.rm(dir, { recursive: true, force: true }))
})

describe('optimize-images', () => {
  it('shrinks a truecolour PNG and leaves it a readable image', async () => {
    const results = await optimize(dir)
    expect(results).toHaveLength(1)
    expect(results[0].file).toContain('big.png')
    expect(results[0].after).toBeLessThan(results[0].before)

    // The saving must be real on disk, not just reported.
    const onDisk = (await stat(path.join(dir, 'big.png'))).size
    expect(onDisk).toBeLessThan(originalSize)

    // And the file must still decode at its original dimensions — a script
    // that "saves 100%" by truncating the file would pass a size assertion.
    const meta = await sharp(await readFile(path.join(dir, 'big.png'))).metadata()
    expect(meta.width).toBe(1400)
    expect(meta.height).toBe(1000)
  }, 60_000)

  it('is idempotent, so a second run produces no diff', async () => {
    // Runs after the first test has already written the optimized bytes.
    expect(await optimize(dir)).toEqual([])
  }, 60_000)

  it('reports without writing under --check', async () => {
    await wastefulPng(path.join(dir, 'again.png'))
    const before = (await stat(path.join(dir, 'again.png'))).size
    const results = await optimize(dir, { check: true })
    expect(results.some((r) => r.file.endsWith('again.png'))).toBe(true)
    expect((await stat(path.join(dir, 'again.png'))).size).toBe(before)
  }, 60_000)
})
