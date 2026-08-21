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

/**
 * Find blobs of selection colour too big to be an outline stroke.
 *
 * `healOutlines` repaints thin strokes, which is right for a 2px line drawn over
 * the design. It is *not* right for Figma's dimension badge — a filled rounded
 * rectangle with white text in it — or for a panel edge or a cookie banner.
 * Interpolating those away leaves a smear that still is not the design, so they
 * have to fail the capture instead of being repaired.
 *
 * The distinction is size. A selection stroke is 1-2 device px wide however long
 * it runs; a badge is tens of px in both directions. So: any blob whose smaller
 * dimension exceeds `maxStrokeWidth` is viewer chrome.
 */
export async function findViewerChrome(file, { maxStrokeWidth = 8 } = {}) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const o = i * channels
    if (isSelectionColour(data[o], data[o + 1], data[o + 2])) mask[i] = 1
  }
  return components(mask, width, height)
    .map((b) => ({ ...b, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 }))
    .filter((b) => Math.min(b.w, b.h) > maxStrokeWidth)
    .sort((a, b) => b.n - a.n)
}

/**
 * Throw if `file` contains Figma's own interface.
 *
 * Three assets shipped from this pipeline carrying viewer chrome: a reference
 * that was mostly Figma UI, and a crop whose bottom edge caught the selection
 * outline and the dimension badge. In both cases the crop *succeeded* and the
 * fidelity check passed, because a small badge barely moves a coarse block
 * score. Nothing but looking at the file caught it. This is that look, automated.
 */
export async function assertNoViewerChrome(file, options) {
  const blobs = await findViewerChrome(file, options)
  if (!blobs.length) return
  const worst = blobs
    .slice(0, 3)
    .map((b) => `${b.w}x${b.h} at ${b.x0},${b.y0}`)
    .join('; ')
  throw new Error(
    `${file} contains Figma interface, not design: ${blobs.length} selection-coloured ` +
      `region(s) too large to be an outline stroke (${worst}). ` +
      `A dimension badge here usually means the declared node size is wrong — ` +
      `read the size off the badge and correct the target.`,
  )
}

/**
 * Repaint pixels that are part of a selection outline, interpolating each from
 * the nearest clean pixel above and below in its own column.
 *
 * Insetting the crop only escapes the outline drawn *on* the node's own bounds.
 * Figma also strokes ancestors and component instances, and those strokes can
 * cross the middle of the crop — a purple instance outline ran straight through
 * the header laptop. Those pixels are viewer chrome, not design, so remove them
 * rather than shipping them into `public/`.
 */
export async function healOutlines(buffer, { width, height, channels }) {
  const bad = new Uint8Array(width * height)
  let found = 0
  for (let i = 0; i < width * height; i++) {
    const o = i * channels
    if (isSelectionColour(buffer[o], buffer[o + 1], buffer[o + 2])) {
      bad[i] = 1
      found++
    }
  }
  if (!found) return 0

  // Grow the mask: an antialiased stroke has a fringe that is off-colour but
  // still wrong, and repainting a 2px halo is cheaper than detecting it.
  const mask = new Uint8Array(bad)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!bad[y * width + x]) continue
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) mask[ny * width + nx] = 1
        }
      }
    }
  }

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (!mask[y * width + x]) continue
      let up = y - 1
      while (up >= 0 && mask[up * width + x]) up--
      let down = y + 1
      while (down < height && mask[down * width + x]) down++
      const a = up >= 0 ? up : down
      const b = down < height ? down : up
      if (a < 0 || b < 0) continue
      const t = b === a ? 0 : (y - a) / (b - a)
      const o = (y * width + x) * channels
      const oa = (a * width + x) * channels
      const ob = (b * width + x) * channels
      for (let c = 0; c < channels; c++) {
        buffer[o + c] = Math.round(buffer[oa + c] * (1 - t) + buffer[ob + c] * t)
      }
    }
  }
  return found
}

/**
 * Crop a region positioned relative to the selection outline, in design px.
 *
 * Some assets cannot be selected on their own: the header's laptop is a child of
 * a frame that clips it, and loading its node id selects something whose bounds
 * are not the pixels wanted. For those, select a sibling whose bounds *are*
 * unambiguous and describe the wanted rectangle as an offset from it, measured
 * off the design. The offset is design px; `scale` converts.
 */
export async function cropRelative(file, out, { w, h, scale, crop }) {
  const box = await findSelection(file, { w, h, scale })
  const left = Math.round(box.x0 + 1 + crop.dx * scale)
  const top = Math.round(box.y0 + 1 + crop.dy * scale)
  const cw = Math.round(crop.w * scale)
  const ch = Math.round(crop.h * scale)
  const meta = await sharp(file).metadata()
  if (left < 0 || top < 0 || left + cw > meta.width || top + ch > meta.height) {
    throw new Error(
      `relative crop ${left},${top} ${cw}x${ch} falls outside ${file} (${meta.width}x${meta.height})`,
    )
  }
  const { data, info } = await sharp(file)
    .extract({ left, top, width: cw, height: ch })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const healed = await healOutlines(data, info)
  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png({ compressionLevel: 9 })
    .toFile(out)
  return { box, cw, ch, healed }
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
