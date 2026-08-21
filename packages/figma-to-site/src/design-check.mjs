/**
 * Compare a rendered section against its Figma design reference.
 *
 * Shared by two callers so the rule lives in one place: the `figma-verify-design`
 * CLI (for iterating locally) and a project's own Playwright spec generating one
 * test per section, so CI names the section that drifted.
 *
 * Two axes, because they fail on different things:
 *
 *   1. Aspect ratio, against the size recorded in the trust manifest
 *      (`<refsDir>/refs.json`).
 *      Geometry errors — doubled padding, a duplicated background, an image at
 *      the wrong crop, a container at the wrong max-width — change a section's
 *      shape long before they change its average colour. This compares against a
 *      number read off the design rather than against a screenshot, so a bad
 *      screenshot cannot make it lie.
 *   2. Coarse block colour, against the reference PNG. Both images are reduced to
 *      a small grid of mean colours and compared cell by cell. At that resolution
 *      font hinting, antialiasing and image resampling wash out, while a wrong
 *      background, a missing element or a transposed layout survives. It runs
 *      only where refs.json vouches for the PNG.
 *
 * Neither is a pixel-diff, deliberately: between a live browser and a Figma
 * raster, a pixel-diff is noise at every threshold that would still catch a real
 * defect.
 */
import { existsSync, readFileSync } from 'node:fs'
import sharp from 'sharp'

/**
 * Where a project keeps its reference PNGs and `refs.json`. Every entry point
 * takes `refsDir` explicitly; this is only the conventional default.
 */
export const DEFAULT_REFS_DIR = 'design/refs'

/** Coarse grid width in cells. 48 keeps layout, discards glyph detail. */
const GRID = 48

/**
 * Defaults, set from the spread of the sections that were already correct, with
 * headroom. A section needing more says so in refs.json, with its reason.
 */
export const ASPECT_TOLERANCE = 0.05
export const BLOCK_TOLERANCE = 34

/**
 * Load a project's trust manifest.
 *
 * Synchronous on purpose: a Playwright spec generates one test per section at
 * collection time, and Playwright compiles specs without top-level await. An
 * async loader here forces every consumer into a barrel of workarounds.
 *
 * The returned object carries the `refsDir` it was called with — not one read from
 * the file — so `checkSection` resolves reference PNGs from the same directory the
 * caller loaded the manifest from.
 */
export function loadManifest(refsDir = DEFAULT_REFS_DIR) {
  const manifest = JSON.parse(readFileSync(`${refsDir}/refs.json`, 'utf8'))
  const sections = manifest.sections
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) {
    throw new Error(`${refsDir}/refs.json has no "sections" object`)
  }
  // A manifest with zero sections generates zero checks, and a suite of zero
  // checks passes. That is the failure this whole package exists to prevent.
  if (!Object.keys(sections).length) {
    throw new Error(`${refsDir}/refs.json has an empty "sections" object — nothing would be checked`)
  }
  for (const [name, spec] of Object.entries(manifest.sections)) {
    if (!Array.isArray(spec.size) || spec.size.length !== 2 || !spec.size.every((n) => n > 0)) {
      throw new Error(`${refsDir}/refs.json: ${name}.size must be [width, height] in design px`)
    }
    if (!spec.sizeFrom) {
      throw new Error(
        `${refsDir}/refs.json: ${name} needs sizeFrom — where its size came from is what makes ` +
          `it trustworthy (see the trust-manifest rules in SKILL.md)`,
      )
    }
  }
  // `refsDir` last: the caller's path is authoritative, so a stray `refsDir` field
  // in refs.json cannot point one entry point at a different reference directory.
  return { ...manifest, refsDir }
}

const rowsFor = (aspect) => Math.max(1, Math.round(GRID / aspect))

function grid(file, rows) {
  return sharp(file)
    .flatten({ background: '#ffffff' })
    .resize(GRID, rows, { fit: 'fill', kernel: 'cubic' })
    .removeAlpha()
    .raw()
    .toBuffer()
}

/**
 * Check one section's render. `spec` is its entry from refs.json.
 * Returns `{ failures, ... }`; `failures` empty means it matches.
 */
export async function checkSection(section, spec, renderPath, refsDir = DEFAULT_REFS_DIR) {
  const meta = await sharp(renderPath).metadata()
  const renderAspect = meta.width / meta.height
  const designAspect = spec.size[0] / spec.size[1]
  const aspectDelta = Math.abs(renderAspect - designAspect) / designAspect

  const failures = []
  if (aspectDelta > ASPECT_TOLERANCE) {
    failures.push(
      `aspect ${renderAspect.toFixed(3)} vs design ${designAspect.toFixed(3)} ` +
        `(${(aspectDelta * 100).toFixed(1)}% off, limit ${(ASPECT_TOLERANCE * 100).toFixed(0)}%) ` +
        `— design is ${spec.size[0]}x${spec.size[1]} (${spec.sizeFrom}), render is ` +
        `${meta.width / 2}x${(meta.height / 2).toFixed(0)} css px`,
    )
  }

  const refPath = `${refsDir}/${section}.png`
  let block = null
  if (spec.blockCheck) {
    if (!existsSync(refPath)) {
      failures.push(`refs.json enables the content check but ${refPath} is missing`)
    } else {
      const limit = spec.blockTolerance ?? BLOCK_TOLERANCE
      // Compare at the *design* aspect so a wrong shape is not punished twice;
      // the aspect check already reported it.
      const rows = rowsFor(designAspect)
      const [a, b] = await Promise.all([grid(renderPath, rows), grid(refPath, rows)])
      let total = 0
      for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i])
      block = total / a.length
      if (block > limit) failures.push(`block difference ${block.toFixed(1)} (limit ${limit})`)
    }
  }

  return {
    section,
    renderAspect,
    designAspect,
    aspectDelta,
    block,
    blockChecked: Boolean(spec.blockCheck),
    failures,
  }
}

/**
 * Screenshot one section from a Playwright page. Fails loudly when the section
 * is not on the page exactly once: a renamed or duplicated `data-section` must
 * not read as "nothing to check".
 */
export async function screenshotSection(page, section, renderPath) {
  const el = page.locator(`[data-section="${section}"]`)
  const matches = await el.count()
  if (matches !== 1) {
    throw new Error(`expected exactly one [data-section="${section}"] on the page, found ${matches}`)
  }
  await el.screenshot({ path: renderPath })
}

/**
 * Wait for every image on the page to decode, and throw if any failed.
 *
 * An image that has not decoded screenshots as blank space, which would fail the
 * block check for a reason that has nothing to do with the design. But an image
 * that failed to *load* must not be measured at all: a 404 leaves
 * `complete === true` with `naturalWidth === 0`, so filtering on `!complete`
 * would skip it entirely and swallowing `decode()` rejections would hide it.
 * Given that this whole check exists because the wrong pixels shipped once, a
 * missing asset is a hard failure, not a measurement.
 */
export async function awaitImages(page) {
  const broken = await page.evaluate(async () => {
    const failures = await Promise.all(
      Array.from(document.images).map(async (img) => {
        try {
          await img.decode()
        } catch {
          return img.currentSrc || img.src || '(no src)'
        }
        // decode() resolves for a zero-byte or errored image in some engines, so
        // check the decoded dimensions too.
        return img.naturalWidth === 0 ? img.currentSrc || img.src || '(no src)' : null
      }),
    )
    return failures.filter(Boolean)
  })
  if (broken.length) {
    throw new Error(`these images failed to load, so the page cannot be checked:\n  ${broken.join('\n  ')}`)
  }
}
