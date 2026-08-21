/**
 * Locate Figma's selection rectangle in a canvas capture and crop to it.
 *
 * Loading `?node-id=<node>` selects the node, and the viewer strokes a 1-2px
 * outline exactly on its bounds — blue for a plain node, purple for a component
 * instance — plus a small dimension badge below it. Finding that outline is a
 * more reliable way to locate the node's pixels than any coordinate arithmetic.
 *
 * Ancestor frames get a *dashed* outline in the same colour, so a naive min/max
 * over coloured pixels is wrong. Connected components fix it: the dashes fall
 * apart into many tiny blobs while the selection outline stays one blob whose
 * bounding box is the node's bounds.
 */
import sharp from 'sharp'

/** Figma's selection blue (#0d99ff) and component purple (#9747ff / #8a38f5). */
function isSelectionColour(r, g, b) {
  if (b < 170) return false
  const blue = r < 110 && g > 110 && g < 210 && b - g > 40
  const purple = r > 100 && r < 200 && g < 110 && b - r > 40
  return blue || purple
}

/** Bounding boxes of 8-connected runs of selection-coloured pixels. */
function components(mask, width, height) {
  const labels = new Int32Array(width * height).fill(-1)
  const boxes = []
  const stack = []
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || labels[i] !== -1) continue
    const id = boxes.length
    const box = { x0: i % width, y0: (i / width) | 0, x1: i % width, y1: (i / width) | 0, n: 0 }
    boxes.push(box)
    stack.push(i)
    labels[i] = id
    while (stack.length) {
      const p = stack.pop()
      const px = p % width
      const py = (p / width) | 0
      box.n++
      if (px < box.x0) box.x0 = px
      if (px > box.x1) box.x1 = px
      if (py < box.y0) box.y0 = py
      if (py > box.y1) box.y1 = py
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx
          const ny = py + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const q = ny * width + nx
          if (mask[q] && labels[q] === -1) {
            labels[q] = id
            stack.push(q)
          }
        }
      }
    }
  }
  return boxes
}

/**
 * Find the selection outline for a node of `w`x`h` design px.
 * `scale` is device px per design px when known; otherwise the best-matching
 * aspect ratio wins, which is what the zoomed-in icon captures need.
 */
export async function findSelection(file, { w, h, scale }) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const o = i * channels
    if (isSelectionColour(data[o], data[o + 1], data[o + 2])) mask[i] = 1
  }
  const aspect = w / h
  const candidates = components(mask, width, height)
    .map((b) => ({ ...b, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 }))
    .filter((b) => b.w > 16 && b.h > 16)
    .map((b) => ({
      ...b,
      err: scale
        ? Math.abs(b.w - w * scale) + (h ? Math.abs(b.h - h * scale) : 0)
        : Math.abs(b.w / b.h - aspect) * 400 - b.w / 50,
    }))
    .sort((a, b) => a.err - b.err)
  if (!candidates.length) throw new Error(`no selection outline found in ${file}`)
  return candidates[0]
}

/** Crop inside the outline so no selection colour survives, then optionally resize. */
export async function cropToSelection(file, out, { w, h, scale, inset = 5, resizeTo }) {
  const box = await findSelection(file, { w, h, scale })
  const left = box.x0 + inset
  const top = box.y0 + inset
  const cw = box.w - inset * 2
  // The dimension badge sits just below the outline and can fuse onto it, which
  // stretches the box downward. The node's own aspect ratio is the correction.
  const byAspect = h ? Math.round(box.w / (w / h)) - inset * 2 : box.h - inset * 2
  const ch = Math.abs(byAspect - (box.h - inset * 2)) > 0.02 * byAspect ? byAspect : box.h - inset * 2
  if (cw < 8 || ch < 8) throw new Error(`selection too small in ${file}: ${cw}x${ch}`)
  let img = sharp(file).extract({ left, top, width: cw, height: ch })
  if (resizeTo) img = img.resize(resizeTo, resizeTo, { fit: 'fill' })
  await img.png().toFile(out)
  return { box, cw, ch }
}
