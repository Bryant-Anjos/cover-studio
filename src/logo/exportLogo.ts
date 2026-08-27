import type { LogoState } from '../types'
import { downloadCanvas } from '../lib/download'

/** Render the circular crop with a transparent outside + feathered edge. */
export function renderRoundLogo(
  img: HTMLImageElement,
  logo: LogoState,
): HTMLCanvasElement {
  const R = logo.r + logo.padding
  const size = Math.max(4, Math.round(logo.outSize ?? 2 * R))
  const k = size / 2 / R

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.save()
  ctx.translate(size / 2, size / 2)
  ctx.scale(k, k)
  ctx.translate(-logo.cx, -logo.cy)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0)
  ctx.restore()

  // punch the circle out of what we just drew
  ctx.globalCompositeOperation = 'destination-in'
  const cx = size / 2
  const cy = size / 2
  const rPx = logo.r * k
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rPx)
  const solidStop = clamp01((logo.r - logo.feather) / Math.max(logo.r, 1))
  grad.addColorStop(0, '#fff')
  grad.addColorStop(Math.min(solidStop, 0.999), '#fff')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'source-over'

  return canvas
}

export function exportRoundLogo(img: HTMLImageElement, logo: LogoState): void {
  const canvas = renderRoundLogo(img, logo)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  downloadCanvas(canvas, `logo-redonda-${stamp}.png`, 'image/png')
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
