/**
 * Synthetic Figma-viewer captures, built with sharp rather than committed as PNGs.
 *
 * The detectors under test key off exact colours and blob geometry, so a fixture
 * has to be described in those terms to be worth anything. Generating them makes
 * each test state its own premise — "a 2px blue stroke", "a 237x34 filled badge" —
 * instead of pointing at an opaque binary whose relevant property is invisible.
 */
import sharp from 'sharp'

/** Figma's selection blue and component-instance purple, as the viewer paints them. */
export const SELECTION_BLUE = { r: 13, g: 153, b: 255 }
export const INSTANCE_PURPLE = { r: 151, g: 71, b: 255 }

/**
 * Paint a canvas: a background, then rectangles on top.
 *
 * `rects` are `{ x, y, w, h, colour }` in device px, drawn in order.
 */
export async function canvas(path, { width, height, background = { r: 240, g: 240, b: 240 }, rects = [] }) {
  const channels = 3
  const data = Buffer.alloc(width * height * channels)
  for (let i = 0; i < width * height; i++) {
    data[i * channels] = background.r
    data[i * channels + 1] = background.g
    data[i * channels + 2] = background.b
  }
  for (const { x, y, w, h, colour } of rects) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const px = x + dx
        const py = y + dy
        if (px < 0 || py < 0 || px >= width || py >= height) continue
        const o = (py * width + px) * channels
        data[o] = colour.r
        data[o + 1] = colour.g
        data[o + 2] = colour.b
      }
    }
  }
  await sharp(data, { raw: { width, height, channels } }).png().toFile(path)
  return path
}

/**
 * A capture with a selection outline around a node, as the viewer draws it:
 * a hollow `strokeWidth`-px rectangle on the node's bounds.
 */
export function outline({ x, y, w, h, strokeWidth = 2, colour = SELECTION_BLUE }) {
  return [
    { x, y, w, h: strokeWidth, colour },
    { x, y: y + h - strokeWidth, w, h: strokeWidth, colour },
    { x, y, w: strokeWidth, h, colour },
    { x: x + w - strokeWidth, y, w: strokeWidth, h, colour },
  ]
}

/**
 * Figma's dimension badge: a *filled* rounded rectangle in selection blue, drawn
 * just below the outline. Approximated here as a plain filled rectangle — the
 * detector discriminates on size, not on corner radius.
 */
export function badge({ x, y, w = 237, h = 34, colour = SELECTION_BLUE }) {
  return [{ x, y, w, h, colour }]
}
