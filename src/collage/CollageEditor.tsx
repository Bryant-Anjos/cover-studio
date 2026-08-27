import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSyncExternalStore } from 'react'
import type { CollageState, Divider, Overlay, Selection } from '../types'
import {
  clamp,
  dividerLine,
  distToSegment,
  panelPolygon,
  pointInPoly,
} from '../lib/geometry'
import { imagesVersion, subscribeImages } from '../lib/images'
import { renderCollage } from './render'
import {
  overlayHandles,
  overlayMetrics,
  screenToOverlayLocal,
} from './overlay'

const HANDLE_HIT = 13
const DIVIDER_HIT = 11
const MIN_GAP = 0.03

type Drag =
  | { kind: 'panel-pan'; id: string; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'overlay-move'; id: string; sx: number; sy: number; ox: number; oy: number }
  | {
      kind: 'overlay-scale'
      id: string
      cx: number
      cy: number
      startDist: number
      startScale: number
    }
  | {
      kind: 'overlay-rotate'
      id: string
      cx: number
      cy: number
      startAngle: number
      startRot: number
    }
  | { kind: 'divider-move'; id: string; sx: number; startPos: number }
  | { kind: 'divider-end'; id: string; end: 'top' | 'bot'; fixedX: number }

export interface CollageEditorProps {
  value: CollageState
  onChange: (next: CollageState) => void
  selection: Selection
  onSelect: (s: Selection) => void
}

export function CollageEditor({
  value,
  onChange,
  selection,
  onSelect,
}: CollageEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [viewScale, setViewScale] = useState(0.2)

  const imgVersion = useSyncExternalStore(subscribeImages, imagesVersion)

  // keep latest props reachable from event handlers without re-binding
  const stateRef = useRef(value)
  stateRef.current = value
  const selRef = useRef(selection)
  selRef.current = selection

  // fit the stage to its container
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const pad = 32
      const availW = el.clientWidth - pad
      const availH = el.clientHeight - pad
      const s = Math.min(availW / value.width, availH / value.height)
      setViewScale(s > 0 ? s : 0.05)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [value.width, value.height])

  // render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssW = value.width * viewScale
    const cssH = value.height * viewScale
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderCollage(ctx, value, { scale: viewScale, selection, showHandles: true })
  }, [value, viewScale, selection, imgVersion])

  const pointer = useCallback((e: PointerEvent | React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const commit = useCallback(
    (next: CollageState) => onChange(next),
    [onChange],
  )

  const updateOverlay = useCallback(
    (id: string, patch: Partial<Overlay>) => {
      const st = stateRef.current
      commit({
        ...st,
        overlays: st.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)),
      })
    },
    [commit],
  )

  const updateDivider = useCallback(
    (id: string, patch: Partial<Divider>) => {
      const st = stateRef.current
      commit({
        ...st,
        dividers: st.dividers.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      })
    },
    [commit],
  )

  const updatePanelImage = useCallback(
    (id: string, dx: number, dy: number) => {
      const st = stateRef.current
      commit({
        ...st,
        panels: st.panels.map((p) =>
          p.id === id && p.image
            ? {
                ...p,
                image: {
                  ...p.image,
                  offsetX: p.image.offsetX + dx,
                  offsetY: p.image.offsetY + dy,
                },
              }
            : p,
        ),
      })
    },
    [commit],
  )

  const hitTest = useCallback(
    (sx: number, sy: number): { drag: Drag | null; sel: Selection } => {
      const st = stateRef.current
      const cur = selRef.current

      // 1. handles of the currently selected overlay
      if (cur?.kind === 'overlay') {
        const o = st.overlays.find((x) => x.id === cur.id)
        const h = o && overlayHandles(o, viewScale)
        if (o && h) {
          const near = (p: [number, number], t = HANDLE_HIT) =>
            Math.hypot(sx - p[0], sy - p[1]) <= t
          const cScreen: [number, number] = [
            o.x * viewScale,
            o.y * viewScale,
          ]
          if (near(h.rot, HANDLE_HIT + 2)) {
            return {
              sel: cur,
              drag: {
                kind: 'overlay-rotate',
                id: o.id,
                cx: cScreen[0],
                cy: cScreen[1],
                startAngle: Math.atan2(sy - cScreen[1], sx - cScreen[0]),
                startRot: o.rotation,
              },
            }
          }
          for (const corner of [h.tl, h.tr, h.br, h.bl]) {
            if (near(corner)) {
              return {
                sel: cur,
                drag: {
                  kind: 'overlay-scale',
                  id: o.id,
                  cx: cScreen[0],
                  cy: cScreen[1],
                  startDist: Math.hypot(sx - cScreen[0], sy - cScreen[1]),
                  startScale: o.scale,
                },
              }
            }
          }
        }
      }

      // 2. overlay bodies, front to back
      for (let i = st.overlays.length - 1; i >= 0; i--) {
        const o = st.overlays[i]
        const m = overlayMetrics(o)
        if (!m) continue
        const [lx, ly] = screenToOverlayLocal(o, sx, sy, viewScale)
        if (Math.abs(lx) <= m.w / 2 && Math.abs(ly) <= m.h / 2) {
          return {
            sel: { kind: 'overlay', id: o.id },
            drag: {
              kind: 'overlay-move',
              id: o.id,
              sx,
              sy,
              ox: o.x,
              oy: o.y,
            },
          }
        }
      }

      // 3. endpoints of the selected divider
      if (cur?.kind === 'divider') {
        const d = st.dividers.find((x) => x.id === cur.id)
        if (d) {
          const { topX, botX } = dividerLine(d, st.width)
          if (Math.hypot(sx - topX * viewScale, sy - 0) <= HANDLE_HIT) {
            return {
              sel: cur,
              drag: { kind: 'divider-end', id: d.id, end: 'top', fixedX: botX },
            }
          }
          if (
            Math.hypot(sx - botX * viewScale, sy - st.height * viewScale) <=
            HANDLE_HIT
          ) {
            return {
              sel: cur,
              drag: { kind: 'divider-end', id: d.id, end: 'bot', fixedX: topX },
            }
          }
        }
      }

      // 4. divider bodies
      for (const d of st.dividers) {
        const { topX, botX } = dividerLine(d, st.width)
        const dist = distToSegment(
          sx,
          sy,
          topX * viewScale,
          0,
          botX * viewScale,
          st.height * viewScale,
        )
        if (dist <= Math.max(DIVIDER_HIT, (d.thickness * viewScale) / 2 + 4)) {
          return {
            sel: { kind: 'divider', id: d.id },
            drag: { kind: 'divider-move', id: d.id, sx, startPos: d.pos },
          }
        }
      }

      // 5. panels
      for (let i = 0; i < st.panels.length; i++) {
        const poly = panelPolygon(i, st.dividers, st.width, st.height, st.gap).map(
          ([x, y]) => [x * viewScale, y * viewScale] as [number, number],
        )
        if (pointInPoly(sx, sy, poly)) {
          const p = st.panels[i]
          return {
            sel: { kind: 'panel', id: p.id },
            drag: p.image
              ? {
                  kind: 'panel-pan',
                  id: p.id,
                  sx,
                  sy,
                  ox: p.image.offsetX,
                  oy: p.image.offsetY,
                }
              : null,
          }
        }
      }

      return { drag: null, sel: null }
    },
    [viewScale],
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const { x, y } = pointer(e)
      const { drag, sel } = hitTest(x, y)
      onSelect(sel)
      dragRef.current = drag
      if (drag) {
        ;(e.target as Element).setPointerCapture?.(e.pointerId)
      }
    },
    [hitTest, onSelect, pointer],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const { x: sx, y: sy } = pointer(e)
      const st = stateRef.current

      switch (d.kind) {
        case 'panel-pan': {
          const dx = (sx - d.sx) / viewScale
          const dy = (sy - d.sy) / viewScale
          updatePanelImage(d.id, dx, dy)
          dragRef.current = { ...d, sx, sy }
          break
        }
        case 'overlay-move': {
          updateOverlay(d.id, {
            x: d.ox + (sx - d.sx) / viewScale,
            y: d.oy + (sy - d.sy) / viewScale,
          })
          break
        }
        case 'overlay-scale': {
          const dist = Math.hypot(sx - d.cx, sy - d.cy)
          const next = clamp(
            (d.startScale * dist) / Math.max(d.startDist, 1),
            0.02,
            60,
          )
          updateOverlay(d.id, { scale: next })
          break
        }
        case 'overlay-rotate': {
          const ang = Math.atan2(sy - d.cy, sx - d.cx)
          let deg = d.startRot + ((ang - d.startAngle) * 180) / Math.PI
          if (e.shiftKey) deg = Math.round(deg / 15) * 15
          updateOverlay(d.id, { rotation: deg })
          break
        }
        case 'divider-move': {
          const idx = st.dividers.findIndex((x) => x.id === d.id)
          const lo = (st.dividers[idx - 1]?.pos ?? 0) + MIN_GAP
          const hi = (st.dividers[idx + 1]?.pos ?? 1) - MIN_GAP
          const pos = clamp(
            d.startPos + (sx - d.sx) / (viewScale * st.width),
            lo,
            hi,
          )
          updateDivider(d.id, { pos })
          break
        }
        case 'divider-end': {
          const movingX = sx / viewScale
          const idx = st.dividers.findIndex((x) => x.id === d.id)
          const topX = d.end === 'top' ? movingX : d.fixedX
          const botX = d.end === 'bot' ? movingX : d.fixedX
          const mid = (topX + botX) / 2
          const lo = (st.dividers[idx - 1]?.pos ?? 0) + MIN_GAP
          const hi = (st.dividers[idx + 1]?.pos ?? 1) - MIN_GAP
          const pos = clamp(mid / st.width, lo, hi)
          const slant = clamp(botX - topX, -st.width * 0.7, st.width * 0.7)
          updateDivider(d.id, { pos, slant })
          break
        }
      }
    },
    [pointer, updateDivider, updateOverlay, updatePanelImage, viewScale],
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  // wheel: scale selected overlay, else zoom the panel image under the cursor
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      const st = stateRef.current
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const factor = Math.exp(-e.deltaY * 0.0016)
      const cur = selRef.current

      if (cur?.kind === 'overlay') {
        const o = st.overlays.find((x) => x.id === cur.id)
        if (o) {
          e.preventDefault()
          commit({
            ...st,
            overlays: st.overlays.map((x) =>
              x.id === o.id
                ? { ...x, scale: clamp(x.scale * factor, 0.02, 60) }
                : x,
            ),
          })
          return
        }
      }
      for (let i = 0; i < st.panels.length; i++) {
        const poly = panelPolygon(i, st.dividers, st.width, st.height, st.gap).map(
          ([x, y]) => [x * viewScale, y * viewScale] as [number, number],
        )
        if (pointInPoly(sx, sy, poly) && st.panels[i].image) {
          e.preventDefault()
          const p = st.panels[i]
          commit({
            ...st,
            panels: st.panels.map((q) =>
              q.id === p.id && q.image
                ? {
                    ...q,
                    image: {
                      ...q.image,
                      zoom: clamp(q.image.zoom * factor, 0.1, 12),
                    },
                  }
                : q,
            ),
          })
          return
        }
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [commit, viewScale])

  // keyboard nudges / delete / z-order for the selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const st = stateRef.current
      const cur = selRef.current
      if (!cur) return
      const step = e.shiftKey ? 10 : 1

      if ((e.key === 'Delete' || e.key === 'Backspace') && cur.kind === 'overlay') {
        e.preventDefault()
        commit({ ...st, overlays: st.overlays.filter((o) => o.id !== cur.id) })
        onSelect(null)
        return
      }

      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      if (arrows[e.key]) {
        e.preventDefault()
        const [dx, dy] = arrows[e.key]
        if (cur.kind === 'overlay') {
          commit({
            ...st,
            overlays: st.overlays.map((o) =>
              o.id === cur.id ? { ...o, x: o.x + dx, y: o.y + dy } : o,
            ),
          })
        } else if (cur.kind === 'panel') {
          commit({
            ...st,
            panels: st.panels.map((p) =>
              p.id === cur.id && p.image
                ? {
                    ...p,
                    image: {
                      ...p.image,
                      offsetX: p.image.offsetX + dx,
                      offsetY: p.image.offsetY + dy,
                    },
                  }
                : p,
            ),
          })
        } else if (cur.kind === 'divider') {
          commit({
            ...st,
            dividers: st.dividers.map((d) =>
              d.id === cur.id
                ? { ...d, pos: clamp(d.pos + dx / st.width, 0.02, 0.98) }
                : d,
            ),
          })
        }
        return
      }

      if ((e.key === '[' || e.key === ']') && cur.kind === 'overlay') {
        e.preventDefault()
        const idx = st.overlays.findIndex((o) => o.id === cur.id)
        const to = e.key === ']' ? idx + 1 : idx - 1
        if (to < 0 || to >= st.overlays.length) return
        const next = st.overlays.slice()
        ;[next[idx], next[to]] = [next[to], next[idx]]
        commit({ ...st, overlays: next })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commit, onSelect])

  return (
    <div className="stage" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="stage-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
    </div>
  )
}
