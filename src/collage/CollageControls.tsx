import { useRef, useState } from 'react'
import type { CollageState, Overlay, Selection } from '../types'
import {
  OUTPUT_PRESETS,
  makeDivider,
  makeOverlay,
  makePanel,
} from '../types'
import { addImageFile, getImage } from '../lib/images'
import {
  ColorInput,
  Field,
  NumberInput,
  Segmented,
  Slider,
  Stepper,
} from '../ui/controls'
import { useFilePicker } from '../ui/useFilePicker'
import { exportCollage, type ExportFormat } from './exportImage'

export interface CollageControlsProps {
  value: CollageState
  onChange: (next: CollageState) => void
  selection: Selection
  onSelect: (s: Selection) => void
  onReset: () => void
}

export function CollageControls({
  value: st,
  onChange,
  selection,
  onSelect,
  onReset,
}: CollageControlsProps) {
  const [wDraft, setWDraft] = useState(st.width)
  const [hDraft, setHDraft] = useState(st.height)
  const [altMag, setAltMag] = useState(135)
  const [format, setFormat] = useState<ExportFormat>('image/jpeg')
  const [quality, setQuality] = useState(0.92)
  const [expScale, setExpScale] = useState(1)

  const patch = (p: Partial<CollageState>) => onChange({ ...st, ...p })

  const setPanelCount = (n: number) => {
    const panels = st.panels.slice()
    const dividers = st.dividers.slice()
    while (panels.length < n) {
      panels.push(makePanel())
      const i = dividers.length
      const prev = dividers[i - 1]?.pos ?? 0
      dividers.push(
        makeDivider((prev + 1) / 2, i % 2 === 0 ? altMag : -altMag),
      )
    }
    while (panels.length > n && panels.length > 2) {
      panels.pop()
      dividers.pop()
    }
    patch({ panels, dividers })
  }

  const distribute = () =>
    patch({
      dividers: st.dividers.map((d, i) => ({
        ...d,
        pos: (i + 1) / st.panels.length,
      })),
    })

  const alternate = () =>
    patch({
      dividers: st.dividers.map((d, i) => ({
        ...d,
        slant: (i % 2 === 0 ? 1 : -1) * altMag,
      })),
    })

  const pendingPanel = useRef<string | null>(null)

  const handleOverlayFiles = async (files: File[]) => {
    const next: Overlay[] = []
    for (const f of files) {
      const key = await addImageFile(f)
      const img = getImage(key)
      const targetW = st.width * 0.4
      const scale = img ? targetW / img.width : 0.5
      next.push(
        makeOverlay(
          key,
          st.width / 2 + next.length * 40,
          st.height / 2 + next.length * 40,
          scale,
        ),
      )
    }
    if (!next.length) return
    onChange({ ...st, overlays: [...st.overlays, ...next] })
    onSelect({ kind: 'overlay', id: next[next.length - 1].id })
  }

  const handlePanelFile = async (files: File[]) => {
    const panelId = pendingPanel.current
    if (!panelId || !files[0]) return
    const key = await addImageFile(files[0])
    onChange({
      ...st,
      panels: st.panels.map((p) =>
        p.id === panelId
          ? {
              ...p,
              image: { key, zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 },
            }
          : p,
      ),
    })
  }

  const overlayPicker = useFilePicker(handleOverlayFiles, true)
  const panelPicker = useFilePicker(handlePanelFile, false)
  const pickPanelImage = (panelId: string) => {
    pendingPanel.current = panelId
    panelPicker.open()
  }

  return (
    <div className="controls">
      {overlayPicker.input}
      {panelPicker.input}
      <section>
        <h3>Dimensões</h3>
        <Field label="Predefinição">
          <select
            value={
              OUTPUT_PRESETS.find((p) => p.w === st.width && p.h === st.height)
                ?.id ?? 'custom'
            }
            onChange={(e) => {
              const p = OUTPUT_PRESETS.find((x) => x.id === e.target.value)
              if (p) {
                setWDraft(p.w)
                setHDraft(p.h)
                patch({ width: p.w, height: p.h })
              }
            }}
          >
            {OUTPUT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Personalizado</option>
          </select>
        </Field>
        <div className="two-col">
          <Field label="Largura">
            <NumberInput
              value={wDraft}
              min={64}
              max={8000}
              onChange={setWDraft}
            />
          </Field>
          <Field label="Altura">
            <NumberInput
              value={hDraft}
              min={64}
              max={8000}
              onChange={setHDraft}
            />
          </Field>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => patch({ width: wDraft, height: hDraft })}
        >
          Aplicar dimensões
        </button>
        <Field label="Cor de fundo" hint="aparece na margem / espaçamento">
          <ColorInput
            value={st.background}
            onChange={(v) => patch({ background: v })}
          />
        </Field>
        <Field label="Espaçamento entre painéis" hint="px">
          <Slider
            value={st.gap}
            min={0}
            max={200}
            step={1}
            onChange={(v) => patch({ gap: v })}
          />
        </Field>
        <Field label="Margem externa" hint="px">
          <Slider
            value={st.margin}
            min={0}
            max={400}
            step={1}
            onChange={(v) => patch({ margin: v })}
          />
        </Field>
      </section>

      <section>
        <h3>Painéis e divisores</h3>
        <Field label="Número de painéis" hint="(2–6)">
          <Stepper value={st.panels.length} min={2} max={6} onChange={setPanelCount} />
        </Field>
        <div className="two-col">
          <Field label="Inclinação padrão">
            <NumberInput value={altMag} min={0} max={800} onChange={setAltMag} />
          </Field>
          <div className="stack-btns">
            <button type="button" className="btn ghost" onClick={alternate}>
              Alternar diagonais
            </button>
            <button type="button" className="btn ghost" onClick={distribute}>
              Distribuir igual
            </button>
          </div>
        </div>
      </section>

      <section>
        <h3>Camadas por cima</h3>
        <button type="button" className="btn" onClick={overlayPicker.open}>
          + Adicionar imagens
        </button>
        {st.overlays.length > 0 && (
          <ul className="layer-list">
            {st.overlays
              .map((o, i) => ({ o, i }))
              .reverse()
              .map(({ o, i }) => (
                <li
                  key={o.id}
                  className={
                    selection?.kind === 'overlay' && selection.id === o.id
                      ? 'active'
                      : ''
                  }
                  onClick={() => onSelect({ kind: 'overlay', id: o.id })}
                >
                  <span>Camada {i + 1}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onChange({
                        ...st,
                        overlays: st.overlays.filter((x) => x.id !== o.id),
                      })
                      onSelect(null)
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>

      {selection?.kind === 'panel' && (
        <PanelEditor
          st={st}
          panelId={selection.id}
          onChange={onChange}
          onPick={() => pickPanelImage(selection.id)}
        />
      )}
      {selection?.kind === 'divider' && (
        <DividerEditor st={st} dividerId={selection.id} onChange={onChange} />
      )}
      {selection?.kind === 'overlay' && (
        <OverlayEditor
          st={st}
          overlayId={selection.id}
          onChange={onChange}
          onSelect={onSelect}
        />
      )}

      <section>
        <h3>Exportar</h3>
        <Field label="Formato">
          <Segmented
            value={format}
            onChange={setFormat}
            options={[
              { value: 'image/jpeg', label: 'JPG' },
              { value: 'image/png', label: 'PNG' },
            ]}
          />
        </Field>
        {format === 'image/jpeg' && (
          <Field label="Qualidade">
            <Slider
              value={quality}
              min={0.4}
              max={1}
              step={0.01}
              onChange={setQuality}
            />
          </Field>
        )}
        <Field label="Resolução">
          <Segmented
            value={String(expScale)}
            onChange={(v) => setExpScale(Number(v))}
            options={[
              { value: '1', label: '1×' },
              { value: '2', label: '2×' },
              { value: '3', label: '3×' },
            ]}
          />
        </Field>
        <p className="muted">
          Saída: {Math.round(st.width * expScale)} × {Math.round(st.height * expScale)} px
        </p>
        <button
          type="button"
          className="btn primary"
          onClick={() => exportCollage(st, expScale, format, quality)}
        >
          Baixar imagem
        </button>
      </section>

      <section>
        <button type="button" className="btn danger-ghost" onClick={onReset}>
          Novo projeto (limpar tudo)
        </button>
      </section>
    </div>
  )
}

function PanelEditor({
  st,
  panelId,
  onChange,
  onPick,
}: {
  st: CollageState
  panelId: string
  onChange: (n: CollageState) => void
  onPick: () => void
}) {
  const panel = st.panels.find((p) => p.id === panelId)
  if (!panel) return null
  const idx = st.panels.findIndex((p) => p.id === panelId)
  const img = panel.image
  const set = (p: Partial<NonNullable<typeof img>>) =>
    onChange({
      ...st,
      panels: st.panels.map((q) =>
        q.id === panelId && q.image ? { ...q, image: { ...q.image, ...p } } : q,
      ),
    })

  return (
    <section className="editor-card">
      <h3>Painel {idx + 1}</h3>
      <button type="button" className="btn" onClick={onPick}>
        {img ? 'Trocar imagem' : 'Escolher imagem'}
      </button>
      {img && (
        <>
          <Field label="Zoom" hint="(roda do mouse)">
            <Slider
              value={img.zoom}
              min={0.1}
              max={8}
              step={0.01}
              onChange={(v) => set({ zoom: v })}
            />
          </Field>
          <Field label="Rotação" hint="graus">
            <Slider
              value={img.rotation}
              min={-180}
              max={180}
              step={1}
              onChange={(v) => set({ rotation: v })}
            />
          </Field>
          <div className="stack-btns">
            <button
              type="button"
              className="btn ghost"
              onClick={() => set({ offsetX: 0, offsetY: 0 })}
            >
              Centralizar
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => set({ zoom: 1, rotation: 0, offsetX: 0, offsetY: 0 })}
            >
              Redefinir
            </button>
            <button
              type="button"
              className="btn danger-ghost"
              onClick={() =>
                onChange({
                  ...st,
                  panels: st.panels.map((q) =>
                    q.id === panelId ? { ...q, image: null } : q,
                  ),
                })
              }
            >
              Remover imagem
            </button>
          </div>
        </>
      )}
      {!img && (
        <Field label="Cor do painel vazio">
          <ColorInput
            value={panel.bg}
            onChange={(v) =>
              onChange({
                ...st,
                panels: st.panels.map((q) =>
                  q.id === panelId ? { ...q, bg: v } : q,
                ),
              })
            }
          />
        </Field>
      )}
    </section>
  )
}

function DividerEditor({
  st,
  dividerId,
  onChange,
}: {
  st: CollageState
  dividerId: string
  onChange: (n: CollageState) => void
}) {
  const d = st.dividers.find((x) => x.id === dividerId)
  if (!d) return null
  const idx = st.dividers.findIndex((x) => x.id === dividerId)
  const set = (p: Partial<typeof d>) =>
    onChange({
      ...st,
      dividers: st.dividers.map((x) => (x.id === dividerId ? { ...x, ...p } : x)),
    })

  return (
    <section className="editor-card">
      <h3>Divisor {idx + 1}</h3>
      <Field label="Posição" hint="% da largura">
        <Slider
          value={d.pos * 100}
          min={2}
          max={98}
          step={0.1}
          onChange={(v) => set({ pos: v / 100 })}
        />
      </Field>
      <Field label="Inclinação" hint="px (− = /, + = \\)">
        <Slider
          value={d.slant}
          min={-800}
          max={800}
          step={1}
          onChange={(v) => set({ slant: v })}
        />
      </Field>
      <Field label="Cor">
        <ColorInput value={d.color} onChange={(v) => set({ color: v })} />
      </Field>
      <Field label="Espessura" hint="px">
        <Slider
          value={d.thickness}
          min={0}
          max={80}
          step={1}
          onChange={(v) => set({ thickness: v })}
        />
      </Field>
      <Field label="Brilho (blur)" hint="px">
        <Slider
          value={d.glow}
          min={0}
          max={120}
          step={1}
          onChange={(v) => set({ glow: v })}
        />
      </Field>
      <Field label="Força do brilho">
        <Slider
          value={d.glowStrength}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set({ glowStrength: v })}
        />
      </Field>
    </section>
  )
}

function OverlayEditor({
  st,
  overlayId,
  onChange,
  onSelect,
}: {
  st: CollageState
  overlayId: string
  onChange: (n: CollageState) => void
  onSelect: (s: Selection) => void
}) {
  const o = st.overlays.find((x) => x.id === overlayId)
  if (!o) return null
  const idx = st.overlays.findIndex((x) => x.id === overlayId)
  const set = (p: Partial<Overlay>) =>
    onChange({
      ...st,
      overlays: st.overlays.map((x) => (x.id === overlayId ? { ...x, ...p } : x)),
    })
  const setCrop = (p: Partial<Overlay['crop']>) => set({ crop: { ...o.crop, ...p } })

  const reorder = (to: number) => {
    if (to < 0 || to >= st.overlays.length) return
    const next = st.overlays.slice()
    const [item] = next.splice(idx, 1)
    next.splice(to, 0, item)
    onChange({ ...st, overlays: next })
  }

  return (
    <section className="editor-card">
      <h3>Camada {idx + 1}</h3>
      <Field label="Escala" hint="(roda do mouse / cantos)">
        <Slider
          value={o.scale}
          min={0.02}
          max={20}
          step={0.01}
          onChange={(v) => set({ scale: v })}
        />
      </Field>
      <Field label="Rotação" hint="graus (Shift = 15°)">
        <Slider
          value={o.rotation}
          min={-180}
          max={180}
          step={1}
          onChange={(v) => set({ rotation: v })}
        />
      </Field>
      <Field label="Opacidade">
        <Slider
          value={o.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set({ opacity: v })}
        />
      </Field>
      <div className="two-col">
        <Field label="Recorte esquerda">
          <Slider
            value={o.crop.l * 100}
            min={0}
            max={90}
            step={0.5}
            onChange={(v) => setCrop({ l: v / 100 })}
          />
        </Field>
        <Field label="Recorte direita">
          <Slider
            value={o.crop.r * 100}
            min={0}
            max={90}
            step={0.5}
            onChange={(v) => setCrop({ r: v / 100 })}
          />
        </Field>
        <Field label="Recorte topo">
          <Slider
            value={o.crop.t * 100}
            min={0}
            max={90}
            step={0.5}
            onChange={(v) => setCrop({ t: v / 100 })}
          />
        </Field>
        <Field label="Recorte base">
          <Slider
            value={o.crop.b * 100}
            min={0}
            max={90}
            step={0.5}
            onChange={(v) => setCrop({ b: v / 100 })}
          />
        </Field>
      </div>
      <div className="stack-btns">
        <button
          type="button"
          className="btn ghost"
          onClick={() => set({ flipX: !o.flipX })}
        >
          Espelhar ↔
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => set({ rotation: 0 })}
        >
          Endireitar
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => setCrop({ l: 0, t: 0, r: 0, b: 0 })}
        >
          Limpar recorte
        </button>
      </div>
      <div className="stack-btns">
        <button type="button" className="btn ghost" onClick={() => reorder(st.overlays.length - 1)}>
          Trazer p/ frente
        </button>
        <button type="button" className="btn ghost" onClick={() => reorder(0)}>
          Enviar p/ trás
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            const copy = { ...o, id: makeOverlay(o.key, 0, 0, 1).id, x: o.x + 30, y: o.y + 30 }
            onChange({ ...st, overlays: [...st.overlays, copy] })
            onSelect({ kind: 'overlay', id: copy.id })
          }}
        >
          Duplicar
        </button>
        <button
          type="button"
          className="btn danger-ghost"
          onClick={() => {
            onChange({ ...st, overlays: st.overlays.filter((x) => x.id !== o.id) })
            onSelect(null)
          }}
        >
          Excluir
        </button>
      </div>
    </section>
  )
}
