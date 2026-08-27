import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { LogoState } from '../types'
import { addImageFile, getImage, imagesVersion, subscribeImages } from '../lib/images'
import { clamp } from '../lib/geometry'
import { Field, NumberInput, Slider } from '../ui/controls'
import { useFilePicker } from '../ui/useFilePicker'
import { detectCircle } from './detect'
import { exportRoundLogo, renderRoundLogo } from './exportLogo'

export interface LogoEditorProps {
  value: LogoState
  onChange: (next: LogoState) => void
  onReset: () => void
}

export function LogoEditor({ value: logo, onChange, onReset }: LogoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<'move' | 'resize' | null>(null)
  const [box, setBox] = useState({ w: 100, h: 100 })

  const imgVersion = useSyncExternalStore(subscribeImages, imagesVersion)
  const img = logo.key ? getImage(logo.key) : null

  const fit = img
    ? Math.min(box.w / img.width, box.h / img.height)
    : 1
  const offX = img ? (box.w - img.width * fit) / 2 : 0
  const offY = img ? (box.h - img.height * fit) / 2 : 0

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () =>
      setBox({ w: el.clientWidth - 24, h: el.clientHeight - 24 })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // main preview with circle overlay
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.style.width = `${box.w}px`
    canvas.style.height = `${box.h}px`
    canvas.width = Math.round(box.w * dpr)
    canvas.height = Math.round(box.h * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, box.w, box.h)
    if (!img) return

    ctx.save()
    ctx.translate(offX, offY)
    ctx.scale(fit, fit)
    ctx.drawImage(img, 0, 0)
    ctx.restore()

    // dim outside the circle
    ctx.save()
    ctx.fillStyle = 'rgba(10,10,14,0.6)'
    ctx.fillRect(0, 0, box.w, box.h)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(
      offX + logo.cx * fit,
      offY + logo.cy * fit,
      logo.r * fit,
      0,
      Math.PI * 2,
    )
    ctx.fill()
    ctx.restore()

    // ring + handles
    const scx = offX + logo.cx * fit
    const scy = offY + logo.cy * fit
    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(scx, scy, logo.r * fit, 0, Math.PI * 2)
    ctx.stroke()
    const handle = (x: number, y: number) => {
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#22d3ee'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#fff'
      ctx.stroke()
    }
    handle(scx, scy)
    handle(scx + logo.r * fit, scy)
  }, [img, box, fit, offX, offY, logo, imgVersion])

  // transparent-result preview (checkerboard)
  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, el.width, el.height)
    if (!img) return
    const out = renderRoundLogo(img, logo)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(out, 0, 0, el.width, el.height)
  }, [img, logo, imgVersion])

  const toImg = useCallback(
    (e: React.PointerEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect()
      return {
        x: (e.clientX - rect.left - offX) / fit,
        y: (e.clientY - rect.top - offY) / fit,
      }
    },
    [fit, offX, offY],
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (!img) return
    const { x, y } = toImg(e)
    const dist = Math.hypot(x - logo.cx, y - logo.cy)
    const ringPx = Math.abs(dist - logo.r) * fit
    if (ringPx < 12 || Math.hypot(x - (logo.cx + logo.r), y - logo.cy) * fit < 14) {
      dragRef.current = 'resize'
    } else if (dist < logo.r) {
      dragRef.current = 'move'
    } else {
      dragRef.current = null
      return
    }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !img) return
    const { x, y } = toImg(e)
    if (dragRef.current === 'move') {
      onChange({ ...logo, cx: x, cy: y })
    } else {
      onChange({
        ...logo,
        r: clamp(Math.hypot(x - logo.cx, y - logo.cy), 4, Math.max(img.width, img.height)),
      })
    }
  }

  const endDrag = () => {
    dragRef.current = null
  }

  const handleFiles = async (files: File[]) => {
    if (!files[0]) return
    const key = await addImageFile(files[0])
    const im = getImage(key)
    const c = im ? detectCircle(im) : { cx: 0, cy: 0, r: 50 }
    onChange({ ...logo, key, ...c, feather: 2, padding: 0, outSize: null })
  }
  const picker = useFilePicker(handleFiles, false)

  const redetect = () => {
    if (!img) return
    onChange({ ...logo, ...detectCircle(img) })
  }

  const exportSize = logo.outSize ?? Math.round(2 * (logo.r + logo.padding))

  return (
    <>
      <div className="stage logo-stage" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="stage-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>
      <aside className="sidebar">
      <div className="controls">
        {picker.input}
        <section>
          <h3>Logo redonda</h3>
          <button type="button" className="btn" onClick={picker.open}>
            {logo.key ? 'Trocar imagem' : 'Escolher imagem'}
          </button>
          {logo.key && (
            <>
              <button type="button" className="btn ghost" onClick={redetect}>
                Detectar círculo automaticamente
              </button>
              <Field label="Centro X" hint="px na imagem">
                <Slider
                  value={logo.cx}
                  min={0}
                  max={img?.width ?? 1000}
                  step={1}
                  onChange={(v) => onChange({ ...logo, cx: v })}
                />
              </Field>
              <Field label="Centro Y" hint="px na imagem">
                <Slider
                  value={logo.cy}
                  min={0}
                  max={img?.height ?? 1000}
                  step={1}
                  onChange={(v) => onChange({ ...logo, cy: v })}
                />
              </Field>
              <Field label="Raio" hint="px">
                <Slider
                  value={logo.r}
                  min={4}
                  max={Math.max(img?.width ?? 1000, img?.height ?? 1000)}
                  step={1}
                  onChange={(v) => onChange({ ...logo, r: v })}
                />
              </Field>
              <Field label="Suavizar borda" hint="px">
                <Slider
                  value={logo.feather}
                  min={0}
                  max={60}
                  step={0.5}
                  onChange={(v) => onChange({ ...logo, feather: v })}
                />
              </Field>
              <Field label="Margem transparente" hint="px">
                <Slider
                  value={logo.padding}
                  min={0}
                  max={Math.round((img?.width ?? 400) / 2)}
                  step={1}
                  onChange={(v) => onChange({ ...logo, padding: v })}
                />
              </Field>
              <Field label="Tamanho da exportação" hint="px (0 = automático)">
                <NumberInput
                  value={logo.outSize ?? 0}
                  min={0}
                  max={4096}
                  onChange={(v) =>
                    onChange({ ...logo, outSize: v > 0 ? v : null })
                  }
                />
              </Field>
              <p className="muted">
                PNG transparente de {exportSize} × {exportSize} px
              </p>
              <button
                type="button"
                className="btn primary"
                onClick={() => img && exportRoundLogo(img, logo)}
              >
                Baixar PNG
              </button>
            </>
          )}
        </section>

        {logo.key && (
          <section>
            <h3>Prévia (fundo transparente)</h3>
            <div className="checker">
              <canvas ref={previewRef} width={220} height={220} />
            </div>
          </section>
        )}

        <section>
          <button type="button" className="btn danger-ghost" onClick={onReset}>
            Limpar
          </button>
        </section>
      </div>
      </aside>
    </>
  )
}
