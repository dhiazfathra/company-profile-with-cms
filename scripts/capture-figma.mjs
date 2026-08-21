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
import { cropToSelection, findSelection } from './figma-crop.mjs'

const FILE_KEY = 'v7ZzmwgTae9hxdKdNdAe7V'
const RAW = 'design/captures'

/**
 * `w`/`h` are the node's size in Figma design px, used to pick the right
 * selection outline out of the capture. `zoomTo` asks for a canvas zoom-in
 * before the capture so a tiny node lands on enough pixels to ship.
 */
const TARGETS = [
  { name: 'Header', node: '1-122', w: 1200, h: 362, out: 'public/img/header.png' },
  { name: 'Benefits', node: '1-166', w: 1200, h: 620, out: 'public/img/benefits.png' },
  { name: 'FeaturesCarousel', node: '1-187', w: 590, h: 711, out: 'public/img/features-carousel.png' },
  { name: 'Testimonial', node: '1-224', w: 590, h: 669, out: 'public/img/testimonial.png' },
  { name: 'Showcase', node: '1-252', w: 1200, h: 664, out: 'public/img/showcase.png' },
  { name: 'FooterLogo', node: '1-264', w: 32, h: 70, out: 'public/img/footer-logo.png', zoomTo: 700 },
  { name: 'IconCable', node: '1-147', w: 24, h: 24, out: 'public/icons/cable.png', zoomTo: 700, resizeTo: 128 },
  { name: 'IconEarth', node: '1-152', w: 24, h: 24, out: 'public/icons/earth.png', zoomTo: 700, resizeTo: 128 },
  { name: 'IconAccount', node: '1-157', w: 24, h: 24, out: 'public/icons/account.png', zoomTo: 700, resizeTo: 128 },
  { name: 'IconChart', node: '1-162', w: 24, h: 24, out: 'public/icons/chart.png', zoomTo: 700, resizeTo: 128 },
  { name: 'CenteredCta', node: '1-253', w: 1200, h: 464, out: 'design/refs/CenteredCta.png' },
  { name: 'Footer', node: '1-257', w: 1200, h: 519, out: 'design/refs/Footer.png' },
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

async function capture(page, target) {
  const { name, node, w, h, out, zoomTo, resizeTo } = target
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
  const { cw, ch } = await cropToSelection(raw, out, { w, h, scale, resizeTo })
  console.log(`${out}  ${cw}x${ch}${resizeTo ? ` -> ${resizeTo}px` : ''}`)
}

async function dismissCookieBanner(page) {
  const optOut = page.getByRole('button', { name: /opt out/i }).first()
  if (await optOut.count()) {
    await optOut.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(800)
  }
}

/** Re-crop from the raw captures already on disk, without touching the network. */
async function recrop({ name, w, h, out, zoomTo, resizeTo }) {
  const { cw, ch } = await cropToSelection(`${RAW}/${name}.png`, out, {
    w,
    h,
    scale: zoomTo ? undefined : 2,
    resizeTo,
  })
  console.log(`${out}  ${cw}x${ch}${resizeTo ? ` -> ${resizeTo}px` : ''}`)
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
