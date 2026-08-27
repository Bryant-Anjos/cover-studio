// All geometry values are in OUTPUT pixels (the final image space) unless noted.

export interface Divider {
  id: string
  /** midpoint X as a fraction of output width (0..1) */
  pos: number
  /** signed horizontal offset between bottom and top of the line, in output px.
   *  positive = "\" (top-left → bottom-right), negative = "/" */
  slant: number
  color: string
  /** line width in output px */
  thickness: number
  /** glow blur radius in output px (0 = none) */
  glow: number
  /** glow opacity 0..1 */
  glowStrength: number
}

export interface PanelImage {
  key: string
  /** multiplier on top of the object-cover base scale (1 = exactly cover) */
  zoom: number
  /** pan offset from the panel-bbox centre, in output px */
  offsetX: number
  offsetY: number
  /** degrees */
  rotation: number
}

export interface Panel {
  id: string
  /** fallback fill when there is no image */
  bg: string
  image: PanelImage | null
}

export interface Overlay {
  id: string
  key: string
  /** centre position in output px */
  x: number
  y: number
  /** uniform scale relative to the (cropped) source pixels */
  scale: number
  rotation: number
  opacity: number
  flipX: boolean
  /** fractional inset of each edge, 0..1 */
  crop: { l: number; t: number; r: number; b: number }
}

export interface CollageState {
  width: number
  height: number
  background: string
  /** gap opened between panels along each divider, in output px (0 = flush).
   *  The background colour shows through this gap. */
  gap: number
  /** background border kept around the whole collage, in output px. */
  margin: number
  /** ordered left → right; length === panels.length - 1 */
  dividers: Divider[]
  /** 2..6 */
  panels: Panel[]
  /** drawn on top of everything, in array order (last = frontmost) */
  overlays: Overlay[]
}

export interface LogoState {
  key: string | null
  /** circle centre / radius in SOURCE image px */
  cx: number
  cy: number
  r: number
  /** feather width in source px */
  feather: number
  /** transparent margin kept around the circle in the export, in source px */
  padding: number
  /** if set, the exported PNG is scaled to this square size */
  outSize: number | null
}

export type Selection =
  | { kind: 'panel'; id: string }
  | { kind: 'divider'; id: string }
  | { kind: 'overlay'; id: string }
  | null

export interface AppState {
  tab: 'collage' | 'logo'
  collage: CollageState
  logo: LogoState
}

export const DEFAULT_PINK = '#ff2d9b'

export const OUTPUT_PRESETS = [
  { id: 'capa', label: 'Capa do site — 2400 × 1000', w: 2400, h: 1000 },
  { id: 'wide', label: 'Banner largo — 2400 × 800', w: 2400, h: 800 },
  { id: 'og', label: 'Link / OG — 1200 × 630', w: 1200, h: 630 },
  { id: 'square', label: 'Quadrado — 1080 × 1080', w: 1080, h: 1080 },
  { id: 'story', label: 'Story — 1080 × 1920', w: 1080, h: 1920 },
] as const

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

export function makeDivider(pos: number, slant = 135): Divider {
  return {
    id: uid(),
    pos,
    slant,
    color: DEFAULT_PINK,
    thickness: 12,
    glow: 16,
    glowStrength: 0.28,
  }
}

export function makePanel(): Panel {
  return { id: uid(), bg: '#1c1118', image: null }
}

export function makeOverlay(key: string, x: number, y: number, scale: number): Overlay {
  return {
    id: uid(),
    key,
    x,
    y,
    scale,
    rotation: 0,
    opacity: 1,
    flipX: false,
    crop: { l: 0, t: 0, r: 0, b: 0 },
  }
}

export function defaultCollage(): CollageState {
  const panels = [makePanel(), makePanel(), makePanel(), makePanel()]
  const dividers = [
    makeDivider(0.25, 135),
    makeDivider(0.5, -135),
    makeDivider(0.75, 135),
  ]
  return {
    width: 2400,
    height: 1000,
    background: '#120a0f',
    gap: 0,
    margin: 0,
    dividers,
    panels,
    overlays: [],
  }
}

export function defaultLogo(): LogoState {
  return { key: null, cx: 0, cy: 0, r: 0, feather: 2, padding: 0, outSize: null }
}

export function defaultAppState(): AppState {
  return { tab: 'collage', collage: defaultCollage(), logo: defaultLogo() }
}
