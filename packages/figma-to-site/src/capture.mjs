/**
 * Capture Figma canvas renders as PNGs, without the Figma MCP server.
 *
 * The Figma MCP `download_assets` and `get_screenshot` tools are gated behind a
 * paid seat and metered by quota, so a job can stop working halfway through with
 * some assets present and some not (see ADR-0007). A publicly viewable file is
 * reachable with a browser and no seat, so this drives the real Figma web viewer
 * with Playwright and captures what it paints.
 *
 * These are canvas renders, not asset exports: an exported PNG from a paid seat
 * would be sharper, would carry the original source bitmap, and would keep vector
 * icons as vectors. Anything captured here is a rasterised picture of the design
 * at one zoom level, not the designer's original file. Record that in the trust
 * manifest rather than assuming it away.
 *
 * This module is the library; `bin/capture-figma.mjs` is the CLI over it. The
 * project's own node ids, sizes and output paths live in a config file the CLI
 * loads — never in here. A targets table hardcoded in shared code is a targets
 * table that cannot be reviewed against the design it describes.
 */
import { mkdir } from 'node:fs/promises'
import { assertNoViewerChrome, cropRelative, cropToSelection, findSelection } from './figma-crop.mjs'

/** Ctrl + wheel is the only zoom that reaches the canvas; keyboard shortcuts do not. */
const ZOOM_PER_TICK = 1.28

/**
 * How long to wait after `goto` before the canvas is worth screenshotting.
 *
 * A timer, not an event: the viewer streams geometry and images in after load and
 * emits no ready signal. Too short and the capture catches a half-painted canvas,
 * which crops cleanly and ships wrong — the failure mode this whole package
 * exists to prevent.
 */
const SETTLE_MS = 9000

/**
 * Validate a config before a single pixel is captured.
 *
 * `w`/`h` MUST be the size of the node `node` actually selects, and nothing else.
 * The matcher scores candidate outlines by how close they are to these numbers and
 * takes the best one; it cannot tell "the node is 1200x362" from "some node near
 * here is 1200x362". Two entries in the original targets table carried a size that
 * was not their node's, and both silently produced the wrong region of canvas as a
 * shipped asset. This function cannot catch that — nothing static can — so it
 * catches the shapes it *can* catch and leaves the rest to `verify-design` and
 * `assertNoViewerChrome`.
 */
export function validateConfig(config) {
  const problems = []
  if (!config || typeof config !== 'object') return ['config is not an object']
  if (!config.fileKey) problems.push('fileKey is required (the key in the Figma URL)')
  if (!Array.isArray(config.targets) || !config.targets.length) {
    problems.push('targets must be a non-empty array')
    return problems
  }
  const seen = new Set()
  for (const [i, t] of config.targets.entries()) {
    const at = `targets[${i}]${t?.name ? ` (${t.name})` : ''}`
    if (!t.name) problems.push(`${at}: name is required`)
    else if (seen.has(t.name)) problems.push(`${at}: duplicate name`)
    else seen.add(t.name)
    if (!t.node) problems.push(`${at}: node is required`)
    if (!(t.w > 0)) problems.push(`${at}: w must be the selected node's width in design px`)
    if (!(t.h > 0)) problems.push(`${at}: h must be the selected node's height in design px`)
    if (!t.out) problems.push(`${at}: out is required`)
    if (t.crop) {
      const { dx, dy, w, h } = t.crop
      if ([dx, dy].some((v) => typeof v !== 'number') || !(w > 0) || !(h > 0)) {
        problems.push(`${at}: crop needs numeric dx, dy and positive w, h in design px`)
      }
    }
  }
  return problems
}

async function zoomIn(page, box, zoomTo) {
  const ticks = Math.ceil(Math.log(zoomTo / Math.max(box.w, box.h)) / Math.log(ZOOM_PER_TICK))
  if (ticks <= 0) return
  await page.mouse.move((box.x0 + box.x1) / 4, (box.y0 + box.y1) / 4)
  await page.keyboard.down('Control')
  for (let i = 0; i < ticks; i++) {
    await page.mouse.wheel(0, -120)
    await page.waitForTimeout(200)
  }
  await page.keyboard.up('Control')
  await page.waitForTimeout(2500)
}

async function dismissCookieBanner(page) {
  const optOut = page.getByRole('button', { name: /opt out/i }).first()
  if (await optOut.count()) {
    await optOut.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(800)
  }
}

/**
 * Finish one crop — after proving it is design and not Figma's interface.
 *
 * The assertion goes here, on the one path every crop returns through, so no
 * target can opt out of it. That placement is the point: a check a caller can
 * forget is a check that will be forgotten.
 */
async function finish(out, result, resizeTo) {
  await assertNoViewerChrome(out)
  return { out, ...result, resizeTo }
}

/** Crop from a raw capture already on disk, without touching the network. */
export async function recrop(target, { rawDir }) {
  const { name, w, h, out, zoomTo, resizeTo, crop } = target
  const raw = `${rawDir}/${name}.png`
  const result = crop
    ? await cropRelative(raw, out, { w, h, scale: 2, crop })
    : await cropToSelection(raw, out, { w, h, scale: zoomTo ? undefined : 2, resizeTo })
  return finish(out, result, resizeTo)
}

/** Load a node in the viewer, screenshot its canvas, and crop to the selection. */
export async function captureTarget(page, target, { fileKey, fileName = 'design', rawDir }) {
  const { name, node, w, h, out, zoomTo, resizeTo, crop } = target
  await page.goto(`https://www.figma.com/design/${fileKey}/${fileName}?node-id=${node}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(SETTLE_MS)
  await dismissCookieBanner(page)

  const canvas = page.locator('canvas').first()
  if (!(await canvas.count())) throw new Error('no canvas on page')
  const raw = `${rawDir}/${name}.png`
  await canvas.screenshot({ path: raw })

  // At 100% zoom with deviceScaleFactor 2 the outline is exactly 2x the node.
  // After zooming, absolute size no longer holds and aspect ratio takes over —
  // which is why `scale` becomes undefined rather than being recomputed.
  let scale = 2
  if (zoomTo) {
    await zoomIn(page, await findSelection(raw, { w, h, scale }), zoomTo)
    await canvas.screenshot({ path: raw })
    scale = undefined
  }
  const result = crop
    ? await cropRelative(raw, out, { w, h, scale: scale ?? 2, crop })
    : await cropToSelection(raw, out, { w, h, scale, resizeTo })
  return finish(out, result, resizeTo)
}

/**
 * Capture every target in `config`, or only the named ones.
 *
 * Returns `{ results, failures }` rather than throwing on the first bad target: a
 * capture run is slow and mostly independent per target, so one wrong declared
 * size should not cost the other twelve. The caller decides the exit code.
 */
export async function captureAll(config, { only = [], cropOnly = false, log = () => {} } = {}) {
  const problems = validateConfig(config)
  if (problems.length) throw new Error(`invalid capture config:\n  ${problems.join('\n  ')}`)

  const rawDir = config.rawDir ?? 'design/captures'
  const unknown = only.filter((name) => !config.targets.some((t) => t.name === name))
  if (unknown.length) {
    throw new Error(
      `unknown target(s): ${unknown.join(', ')}\nknown: ${config.targets.map((t) => t.name).join(', ')}`,
    )
  }
  const targets = only.length ? config.targets.filter((t) => only.includes(t.name)) : config.targets

  await mkdir(rawDir, { recursive: true })
  for (const dir of new Set(targets.map((t) => t.out.replace(/\/[^/]+$/, '')))) {
    await mkdir(dir, { recursive: true })
  }

  const results = []
  const failures = []
  const run = async (fn) => {
    for (const target of targets) {
      try {
        const result = await fn(target)
        results.push(result)
        log(result)
      } catch (error) {
        failures.push({ name: target.name, message: error.message })
      }
    }
  }

  if (cropOnly) {
    await run((target) => recrop(target, { rawDir }))
    return { results, failures }
  }

  // Figma's CDN returns 403 to headless Chromium, so this drives a real Chrome
  // window. It is visible while it runs; that is the cost of not having a seat,
  // and the reason capture is a local developer command rather than a CI step.
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 2,
    })
    await run((target) => captureTarget(page, target, { ...config, rawDir }))
  } finally {
    await browser.close()
  }
  return { results, failures }
}
