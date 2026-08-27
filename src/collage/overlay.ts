import type { Overlay } from '../types'
import { getImage } from '../lib/images'
import type { Point } from '../lib/geometry'

export interface OverlayMetrics {
  /** cropped source pixel size */
  sw: number
  sh: number
  /** rendered size in output px */
  w: number
  h: number
}

export function overlayMetrics(o: Overlay): OverlayMetrics | null {
  const img = getImage(o.key)
  if (!img) return null
  const sw = img.width * (1 - o.crop.l - o.crop.r)
  const sh = img.height * (1 - o.crop.t - o.crop.b)
  if (sw <= 0 || sh <= 0) return null
  return { sw, sh, w: sw * o.scale, h: sh * o.scale }
}

/** Rotate a local offset (output px) around the overlay centre; returns screen px. */
export function overlayToScreen(
  o: Overlay,
  lx: number,
  ly: number,
  viewScale: number,
): Point {
  const rad = (o.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [
    o.x * viewScale + (lx * cos - ly * sin) * viewScale,
    o.y * viewScale + (lx * sin + ly * cos) * viewScale,
  ]
}

/** Inverse of {@link overlayToScreen}: screen px → overlay-local output px. */
export function screenToOverlayLocal(
  o: Overlay,
  sx: number,
  sy: number,
  viewScale: number,
): Point {
  const dx = sx / viewScale - o.x
  const dy = sy / viewScale - o.y
  const rad = (-o.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [dx * cos - dy * sin, dx * sin + dy * cos]
}

export interface HandleSet {
  tl: Point
  tr: Point
  br: Point
  bl: Point
  rot: Point
  center: Point
}

/** Screen-px positions of the selection handles. `rot` sits a constant screen
 *  distance above the top edge so it stays grabbable at any zoom. */
export function overlayHandles(
  o: Overlay,
  viewScale: number,
  rotGapScreenPx = 26,
): HandleSet | null {
  const m = overlayMetrics(o)
  if (!m) return null
  const hw = m.w / 2
  const hh = m.h / 2
  const rotGap = rotGapScreenPx / viewScale
  return {
    tl: overlayToScreen(o, -hw, -hh, viewScale),
    tr: overlayToScreen(o, hw, -hh, viewScale),
    br: overlayToScreen(o, hw, hh, viewScale),
    bl: overlayToScreen(o, -hw, hh, viewScale),
    rot: overlayToScreen(o, 0, -hh - rotGap, viewScale),
    center: [o.x * viewScale, o.y * viewScale],
  }
}
