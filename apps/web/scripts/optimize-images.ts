import { readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/**
 * Re-encodes every PNG under `public/` as a palette PNG, in place.
 *
 * Why this exists. The seeded assets are exports from the Figma file, and an
 * exporter writes 24-bit truecolour whether or not the image needs it. These
 * are flat UI renders — large areas of identical colour, a few hundred
 * distinct values — so truecolour buys nothing and costs 21MB across five
 * files. `public/img/showcase.png` alone was 8.01MB, on a page whose whole
 * budget is 1.5MB.
 *
 * Why palette PNG rather than WebP or AVIF, which would be smaller still.
 * The filename is the asset's identity in three places at once: the flat JSON
 * in `content/`, the `sourcePath` the seed writes onto every media row, and
 * the `public/` fallback the outage of 2026-08-30 taught us to keep
 * (ADR-0020). Changing the extension means changing all three and the design
 * baselines with them. Re-encoding keeps every path byte-identical, so this
 * is a pure transfer-size change that nothing else in the repository has to
 * know about. Moving to WebP/AVIF is worth doing; it is a separate change
 * with a migration, not a side effect of an optimisation pass. See ADR-0022.
 *
 * Why not the Next.js image optimizer, which would do all of this per request.
 * It needs `next/image`, and `components/Img.tsx` is a plain `<img>` on
 * purpose: it swaps `src` to a bundled fallback when CMS storage is
 * unreachable, which `next/image` does not let it do. That trade is ADR-0020's,
 * not this script's, to revisit.
 *
 * Idempotent: re-encoding an already-quantized PNG produces the same palette,
 * so a second run writes the same bytes. Run it after adding an asset:
 *
 *   bun run optimize:images
 *
 * `--check` reports what would shrink and exits non-zero instead of writing,
 * which is what CI would call.
 */

/** Below this, quantization noise is worth more than the bytes it saves. */
const MIN_BYTES = 100 * 1024

/** Not a saving worth a diff — and the guard that makes the script idempotent. */
const MIN_SAVING_RATIO = 0.05

export type Result = { file: string; before: number; after: number }

async function pngsUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.png'))
    .map((e) => path.join(e.parentPath, e.name))
}

/** Exported so the test can drive it over a fixture rather than public/. */
export async function optimize(dir: string, { check = false } = {}): Promise<Result[]> {
  const results: Result[] = []

  for (const file of (await pngsUnder(dir)).sort()) {
    const before = (await stat(file)).size
    if (before < MIN_BYTES) continue

    // `effort: 10` is the slowest, smallest setting. This runs by hand, not per
    // request, so the only thing it spends is the author's patience once.
    const encoded = await sharp(file).png({ palette: true, effort: 10 }).toBuffer()
    if (encoded.length > before * (1 - MIN_SAVING_RATIO)) continue

    results.push({ file, before, after: encoded.length })
    if (!check) await writeFile(file, encoded)
  }

  return results
}

const mb = (n: number) => `${(n / 1e6).toFixed(2)}MB`

// `process.argv[1]` rather than Bun's `import.meta.main`: the file is also
// type-checked by `next build`, whose ImportMeta does not declare it.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check')
  const dir = path.join(process.cwd(), 'public')
  const results = await optimize(dir, { check })

  for (const { file, before, after } of results) {
    const saved = Math.round((1 - after / before) * 100)
    console.log(`${path.relative(dir, file)}  ${mb(before)} → ${mb(after)}  (-${saved}%)`)
  }

  if (results.length === 0) {
    console.log('Every PNG in public/ is already at its palette-encoded size.')
  } else {
    const before = results.reduce((n, r) => n + r.before, 0)
    const after = results.reduce((n, r) => n + r.after, 0)
    console.log(`\n${results.length} file(s): ${mb(before)} → ${mb(after)}`)
    if (check) {
      console.error('\nRun `bun run optimize:images` and commit the result.')
      process.exit(1)
    }
  }
}
