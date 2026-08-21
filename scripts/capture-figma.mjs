/**
 * Capture Figma canvas renders as PNGs, without the Figma MCP server.
 *
 * The Figma MCP `download_assets` and `get_screenshot` tools are gated behind a
 * paid seat, and this project's account exhausted the Starter quota mid-extraction
 * (see TOKEN-GAPS.md). The file itself is publicly viewable, so this drives the
 * real Figma web viewer with Playwright and captures what it paints.
 *
 * These are canvas renders, not asset exports: an exported PNG from a paid seat
 * would be sharper, would carry the original source bitmap, and would keep vector
 * icons as vectors. Anything captured here is a rasterised picture of the design
 * at one zoom level, not the designer's original file.
 *
 * Usage: node scripts/capture-figma.mjs [name ...]
 *   with no arguments, captures every target below.
 */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { cropRelative, cropToSelection, findSelection } from './figma-crop.mjs'

const FILE_KEY = 'v7ZzmwgTae9hxdKdNdAe7V'
const RAW = 'design/captures'

/**
 * `w`/`h` are the node's size in Figma design px, used to pick the right
 * selection outline out of the capture. `zoomTo` asks for a canvas zoom-in
 * before the capture so a tiny node lands on enough pixels to ship.
 *
 * `w`/`h` MUST be the size of the node `node` actually selects, and nothing
 * else. The matcher scores candidate outlines by how close they are to these
 * numbers and takes the best one; it cannot tell "the node is 1200x362" from
 * "some node near here is 1200x362". Two entries in this table originally
 * carried a size that was not their node's, and both silently produced the
 * wrong region of canvas as a shipped asset — the header wrote out the green
 * band behind the laptop, and the footer wrote out a strip of Figma's own UI.
 * `bun run verify:design` exists because nothing else caught that.
 *
 * `crop` (design px, relative to the selected outline's top-left) asks for a
 * different rectangle than the selection itself. Use it when the pixels you
 * want cannot be selected on their own — see `cropRelative`.
 */
const TARGETS = [
  {
    // 1-122 is the green band, not the hero image: it is 1200x362 and the
    // laptop sits on top of it, overhanging 139px above its top edge and
    // clipped where the band ends. The band is a flat colour reproduced in CSS
    // by components/sections/Header.tsx, so what this needs to export is the
    // laptop alone, measured off design/refs/Header.png.
    name: 'Header',
    node: '1-122',
    w: 1200,
    h: 362,
    crop: { dx: 149, dy: -139, w: 904, h: 501 },
    out: 'public/img/header.png',
  },
  { name: 'Benefits', node: '1-166', w: 1200, h: 620, out: 'public/img/benefits.png' },
  { name: 'FeaturesCarousel', node: '1-187', w: 590, h: 711, out: 'public/img/features-carousel.png' },
  { name: 'Testimonial', node: '1-224', w: 590, h: 669, out: 'public/img/testimonial.png' },
  // 704, not the 664 originally declared. design/refs/ShowcaseImage.png is the
  // whole section and shows the image filling it corner to corner, so the
  // section's 1200x704 *is* this node; 664 cropped 40px of the picture away and
  // the content check caught it.
  { name: 'Showcase', node: '1-252', w: 1200, h: 704, out: 'public/img/showcase.png' },
  { name: 'FooterLogo', node: '1-264', w: 32, h: 70, out: 'public/img/footer-logo.png', zoomTo: 700 },
  { name: 'IconCable', node: '1-147', w: 24, h: 24, out: 'public/icons/cable.png', zoomTo: 700, resizeTo: 128 },
  { name: 'IconEarth', node: '1-152', w: 24, h: 24, out: 'public/icons/earth.png', zoomTo: 700, resizeTo: 128 },
  { name: 'IconAccount', node: '1-157', w: 24, h: 24, out: 'public/icons/account.png', zoomTo: 700, resizeTo: 128 },
  { name: 'IconChart', node: '1-162', w: 24, h: 24, out: 'public/icons/chart.png', zoomTo: 700, resizeTo: 128 },
  // 462, not the 464 originally declared: the selection outline the capture
  // actually matched measures 1197x461 at 2x. Two px is inside every tolerance
  // here, but a declared size that disagrees with the outline is the exact
  // discrepancy that shipped three wrong assets, so it is not left standing.
  { name: 'CenteredCta', node: '1-253', w: 1200, h: 462, out: 'design/refs/CenteredCta.png' },
  // 1200x250, per the size badge Figma printed beside the selection in the
  // original capture — which declared 519, matched nothing, and cropped a strip
  // of Figma's own UI into design/refs/Footer.png.
  { name: 'Footer', node: '1-257', w: 1200, h: 250, out: 'design/refs/Footer.png' },
]

/** Ctrl + wheel is the only zoom that reaches the canvas; keyboard shortcuts do not. */
const ZOOM_PER_TICK = 1.28

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

function report(out, cw, ch, resizeTo, healed) {
  const notes = [resizeTo ? `-> ${resizeTo}px` : '', healed ? `healed ${healed} outline px` : '']
  console.log(`${out}  ${cw}x${ch} ${notes.filter(Boolean).join(' ')}`.trimEnd())
}

async function capture(page, target) {
  const { name, node, w, h, out, zoomTo, resizeTo, crop } = target
  await page.goto(`https://www.figma.com/design/${FILE_KEY}/Modern-Product-Launch?node-id=${node}`, {
    waitUntil: 'domcontentloaded',
  })
  // The viewer streams geometry and images in after load; there is no ready event.
  await page.waitForTimeout(9000)
  await dismissCookieBanner(page)

  const canvas = page.locator('canvas').first()
  if (!(await canvas.count())) throw new Error('no canvas on page')
  const raw = `${RAW}/${name}.png`
  await canvas.screenshot({ path: raw })

  // At 100% zoom with deviceScaleFactor 2 the outline is exactly 2x the node.
  let scale = 2
  if (zoomTo) {
    await zoomIn(page, await findSelection(raw, { w, h, scale }), zoomTo)
    await canvas.screenshot({ path: raw })
    scale = undefined
  }
  const { cw, ch, healed } = crop
    ? await cropRelative(raw, out, { w, h, scale: scale ?? 2, crop })
    : await cropToSelection(raw, out, { w, h, scale, resizeTo })
  report(out, cw, ch, resizeTo, healed)
}

async function dismissCookieBanner(page) {
  const optOut = page.getByRole('button', { name: /opt out/i }).first()
  if (await optOut.count()) {
    await optOut.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(800)
  }
}

/** Re-crop from the raw captures already on disk, without touching the network. */
async function recrop({ name, w, h, out, zoomTo, resizeTo, crop }) {
  const raw = `${RAW}/${name}.png`
  const { cw, ch, healed } = crop
    ? await cropRelative(raw, out, { w, h, scale: 2, crop })
    : await cropToSelection(raw, out, { w, h, scale: zoomTo ? undefined : 2, resizeTo })
  report(out, cw, ch, resizeTo, healed)
}

const args = process.argv.slice(2)
const cropOnly = args.includes('--crop-only')
const wanted = args.filter((a) => !a.startsWith('--'))

const unknown = wanted.filter((name) => !TARGETS.some((t) => t.name === name))
if (unknown.length) {
  console.error(`Unknown target(s): ${unknown.join(', ')}`)
  console.error(`Known targets: ${TARGETS.map((t) => t.name).join(', ')}`)
  process.exit(1)
}
const targets = wanted.length ? TARGETS.filter((t) => wanted.includes(t.name)) : TARGETS

await mkdir(RAW, { recursive: true })
await mkdir('design/refs', { recursive: true })

if (cropOnly) {
  for (const target of targets) {
    try {
      await recrop(target)
    } catch (error) {
      console.error(`${target.name}: ${error.message}`)
      process.exitCode = 1
    }
  }
  process.exit(process.exitCode ?? 0)
}
// Figma's CDN returns 403 to headless Chromium, so this drives a real Chrome
// window. It is visible while it runs; that is the cost of not having a paid seat.
const browser = await chromium.launch({ headless: false, channel: 'chrome' })
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
})

for (const target of targets) {
  try {
    await capture(page, target)
  } catch (error) {
    console.error(`${target.name}: ${error.message}`)
    process.exitCode = 1
  }
}

await browser.close()
