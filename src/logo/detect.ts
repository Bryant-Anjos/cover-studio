// Guess the circular badge inside a logo image: sample the four corners for the
// background colour, find the bounding box of everything that differs from it,
// and turn that box into a centre + radius.

export interface Circle {
  cx: number
  cy: number
  r: number
}

export function detectCircle(img: HTMLImageElement): Circle {
  const fallback: Circle = {
    cx: img.width / 2,
    cy: img.height / 2,
    r: Math.min(img.width, img.height) / 2,
  }
  const MAX = 700
  const s = Math.min(1, MAX / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * s))
  const h = Math.max(1, Math.round(img.height * s))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return fallback
  ctx.drawImage(img, 0, 0, w, h)
  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, w, h).data
  } catch {
    return fallback
  }

  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ]
  let br = 0
  let bg = 0
  let bb = 0
  for (const [x, y] of corners) {
    const i = (y * w + x) * 4
    br += data[i]
    bg += data[i + 1]
    bb += data[i + 2]
  }
  br /= 4
  bg /= 4
  bb /= 4

  const THRESHOLD = 40
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  let found = false
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const alpha = data[i + 3]
      const diff =
        Math.abs(data[i] - br) +
        Math.abs(data[i + 1] - bg) +
        Math.abs(data[i + 2] - bb)
      if (alpha > 24 && diff > THRESHOLD) {
        found = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (!found) return fallback

  return {
    cx: (minX + maxX) / 2 / s,
    cy: (minY + maxY) / 2 / s,
    r: (Math.max(maxX - minX, maxY - minY) / 2 / s) * 1.01,
  }
}
