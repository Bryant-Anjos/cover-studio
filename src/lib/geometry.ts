import type { Divider } from '../types'

export type Point = [number, number]

export interface Line {
  topX: number
  botX: number
}

/** Divider endpoints in output px. */
export function dividerLine(d: Divider, width: number): Line {
  const mid = d.pos * width
  return { topX: mid - d.slant / 2, botX: mid + d.slant / 2 }
}

/**
 * Polygon (output px) for panel `index`, bounded by its neighbouring dividers.
 * Panel 0's left edge is x=0; the last panel's right edge is x=width.
 * `gap` pulls each divider-derived edge inward by gap/2, opening a gutter
 * between panels (the outer edges and top/bottom are handled by the margin
 * clip in the renderer, so they stay at 0 / width / height here).
 */
export function panelPolygon(
  index: number,
  dividers: Divider[],
  width: number,
  height: number,
  gap = 0,
): Point[] {
  const g = gap / 2
  const left: Line =
    index === 0
      ? { topX: 0, botX: 0 }
      : shiftLine(dividerLine(dividers[index - 1], width), g)
  const right: Line =
    index === dividers.length
      ? { topX: width, botX: width }
      : shiftLine(dividerLine(dividers[index], width), -g)
  return [
    [left.topX, 0],
    [right.topX, 0],
    [right.botX, height],
    [left.botX, height],
  ]
}

function shiftLine(l: Line, dx: number): Line {
  return { topX: l.topX + dx, botX: l.botX + dx }
}

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export function polyBBox(poly: Point[]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of poly) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * Smallest scale so a `imgW × imgH` image, rotated by `rotationDeg`, fully
 * covers a `boxW × boxH` rectangle.
 */
export function coverScale(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
  rotationDeg = 0,
): number {
  const t = Math.abs((rotationDeg * Math.PI) / 180)
  const c = Math.abs(Math.cos(t))
  const s = Math.abs(Math.sin(t))
  const sx = boxW / (imgW * c + imgH * s)
  const sy = boxH / (imgW * s + imgH * c)
  return Math.max(sx, sy)
}

export function pointInPoly(px: number, py: number, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const hit =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v))
