import type { CollageState, Divider, Overlay, Selection } from '../types'
import { getImage } from '../lib/images'
import {
  coverScale,
  dividerLine,
  panelPolygon,
  polyBBox,
  type Point,
} from '../lib/geometry'
import { overlayHandles, overlayMetrics } from './overlay'

export interface RenderOptions {
  /** screen px per output px */
  scale: number
  selection?: Selection
  showHandles?: boolean
}

function tracePoly(ctx: CanvasRenderingContext2D, poly: Point[]) {
  ctx.beginPath()
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath()
}

function drawPanelImage(
  ctx: CanvasRenderingContext2D,
  st: CollageState,
  index: number,
  scale: number,
) {
  const panel = st.panels[index]
  const poly = panelPolygon(index, st.dividers, st.width, st.height, st.gap)
  const img = panel.image ? getImage(panel.image.key) : null
  if (!panel.image || !img) {
    const bb = polyBBox(poly)
    ctx.fillStyle = panel.bg
    ctx.fillRect(
      (bb.x - 2) * scale,
      (bb.y - 2) * scale,
      (bb.w + 4) * scale,
      (bb.h + 4) * scale,
    )
    return
  }
  const bb = polyBBox(poly)
  const base = coverScale(img.width, img.height, bb.w, bb.h, panel.image.rotation)
  const s = base * panel.image.zoom * scale
  const cx = (bb.x + bb.w / 2 + panel.image.offsetX) * scale
  const cy = (bb.y + bb.h / 2 + panel.image.offsetY) * scale
  ctx.translate(cx, cy)
  ctx.rotate((panel.image.rotation * Math.PI) / 180)
  ctx.scale(s, s)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
}

function drawDivider(
  ctx: CanvasRenderingContext2D,
  d: Divider,
  width: number,
  height: number,
  scale: number,
) {
  const { topX, botX } = dividerLine(d, width)
  const dx = botX - topX
  // extend past the top/bottom edges so the ends never peek in
  const x0 = (topX - dx * 0.06) * scale
  const x1 = (botX + dx * 0.06) * scale
  const y0 = -6 * scale
  const y1 = (height + 6) * scale

  ctx.save()
  ctx.lineCap = 'butt'
  if (d.glow > 0 && d.glowStrength > 0) {
    ctx.strokeStyle = d.color
    ctx.shadowColor = d.color
    ctx.shadowBlur = d.glow * scale
    ctx.lineWidth = d.thickness * scale
    ctx.globalAlpha = Math.min(1, d.glowStrength)
    for (let k = 0; k < 3; k++) {
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }
  }
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  ctx.strokeStyle = d.color
  ctx.lineWidth = d.thickness * scale
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.restore()
}

function drawOverlay(ctx: CanvasRenderingContext2D, o: Overlay, scale: number) {
  const img = getImage(o.key)
  if (!img) return
  const sx = img.width * o.crop.l
  const sy = img.height * o.crop.t
  const sw = img.width * (1 - o.crop.l - o.crop.r)
  const sh = img.height * (1 - o.crop.t - o.crop.b)
  if (sw <= 0 || sh <= 0) return
  ctx.save()
  ctx.globalAlpha = o.opacity
  ctx.translate(o.x * scale, o.y * scale)
  ctx.rotate((o.rotation * Math.PI) / 180)
  ctx.scale((o.flipX ? -1 : 1) * o.scale * scale, o.scale * scale)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh)
  ctx.restore()
}

function dot(ctx: CanvasRenderingContext2D, p: Point, r: number, fill: string) {
  ctx.beginPath()
  ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#fff'
  ctx.stroke()
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  st: CollageState,
  selection: Selection,
  scale: number,
) {
  if (!selection) return
  ctx.save()
  ctx.setLineDash([6, 4])
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#22d3ee'

  if (selection.kind === 'panel') {
    const idx = st.panels.findIndex((p) => p.id === selection.id)
    if (idx >= 0) {
      const poly = panelPolygon(idx, st.dividers, st.width, st.height, st.gap).map(
        ([x, y]) => [x * scale, y * scale] as Point,
      )
      tracePoly(ctx, poly)
      ctx.stroke()
    }
  }

  if (selection.kind === 'divider') {
    const d = st.dividers.find((x) => x.id === selection.id)
    if (d) {
      const { topX, botX } = dividerLine(d, st.width)
      ctx.setLineDash([])
      dot(ctx, [topX * scale, 0], 7, '#22d3ee')
      dot(ctx, [botX * scale, st.height * scale], 7, '#22d3ee')
    }
  }

  if (selection.kind === 'overlay') {
    const o = st.overlays.find((x) => x.id === selection.id)
    const h = o && overlayHandles(o, scale)
    if (o && h) {
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(...h.tl)
      ctx.lineTo(...h.tr)
      ctx.lineTo(...h.br)
      ctx.lineTo(...h.bl)
      ctx.closePath()
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(
        (h.tl[0] + h.tr[0]) / 2,
        (h.tl[1] + h.tr[1]) / 2,
      )
      ctx.lineTo(...h.rot)
      ctx.stroke()
      dot(ctx, h.rot, 7, '#22d3ee')
      for (const c of [h.tl, h.tr, h.br, h.bl]) dot(ctx, c, 6, '#fff')
    }
  }
  ctx.restore()
}

export function renderCollage(
  ctx: CanvasRenderingContext2D,
  st: CollageState,
  opts: RenderOptions,
): void {
  const { scale } = opts
  const W = st.width * scale
  const H = st.height * scale

  ctx.save()
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = st.background
  ctx.fillRect(0, 0, W, H)

  // margin: everything below the overlays is confined to the inset content rect,
  // so the background colour frames it
  const m = Math.max(0, st.margin) * scale
  ctx.save()
  if (m > 0) {
    ctx.beginPath()
    ctx.rect(m, m, W - 2 * m, H - 2 * m)
    ctx.clip()
  }

  st.panels.forEach((_, i) => {
    const poly = panelPolygon(i, st.dividers, st.width, st.height, st.gap).map(
      ([x, y]) => [x * scale, y * scale] as Point,
    )
    ctx.save()
    tracePoly(ctx, poly)
    ctx.clip()
    drawPanelImage(ctx, st, i, scale)
    ctx.restore()
  })

  st.dividers.forEach((d) => drawDivider(ctx, d, st.width, st.height, scale))
  ctx.restore()

  st.overlays.forEach((o) => drawOverlay(ctx, o, scale))

  if (opts.showHandles) drawHandles(ctx, st, opts.selection ?? null, scale)
  ctx.restore()
}

export { overlayMetrics }
