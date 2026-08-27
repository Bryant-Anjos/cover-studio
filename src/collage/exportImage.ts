import type { CollageState } from '../types'
import { downloadCanvas } from '../lib/download'
import { renderCollage } from './render'

export type ExportFormat = 'image/png' | 'image/jpeg'

export function exportCollage(
  st: CollageState,
  exportScale: number,
  format: ExportFormat,
  quality: number,
): void {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(st.width * exportScale)
  canvas.height = Math.round(st.height * exportScale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (format === 'image/jpeg') {
    // JPEG has no alpha — fill first so transparent gaps don't turn black
    ctx.fillStyle = st.background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  renderCollage(ctx, st, { scale: exportScale, showHandles: false })
  const ext = format === 'image/png' ? 'png' : 'jpg'
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  downloadCanvas(canvas, `capa-${stamp}.${ext}`, format, quality)
}
