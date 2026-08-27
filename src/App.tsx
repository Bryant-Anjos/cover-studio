import { useEffect, useRef, useState } from 'react'
import type { AppState, CollageState, LogoState, Selection } from './types'
import { defaultAppState, defaultCollage, defaultLogo } from './types'
import { idbGet, idbPut } from './lib/idb'
import { loadImagesFromIdb, pruneImages } from './lib/images'
import { CollageEditor } from './collage/CollageEditor'
import { CollageControls } from './collage/CollageControls'
import { LogoEditor } from './logo/LogoEditor'
import './styles.css'

const STATE_KEY = 'state'

function usedImageKeys(s: AppState): Set<string> {
  const keys = new Set<string>()
  s.collage.panels.forEach((p) => p.image && keys.add(p.image.key))
  s.collage.overlays.forEach((o) => keys.add(o.key))
  if (s.logo.key) keys.add(s.logo.key)
  return keys
}

export function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  // initial load
  useEffect(() => {
    let alive = true
    ;(async () => {
      await loadImagesFromIdb()
      const saved = await idbGet<AppState>('meta', STATE_KEY).catch(() => null)
      if (!alive) return
      if (saved && saved.collage) {
        // fill in fields added after this state was saved
        saved.collage = { ...defaultCollage(), ...saved.collage }
        saved.logo = { ...defaultLogo(), ...saved.logo }
        setState(saved)
      } else {
        setState(defaultAppState())
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // debounced autosave
  useEffect(() => {
    if (!state) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      idbPut('meta', STATE_KEY, state).catch(() => {})
    }, 400)
  }, [state])

  if (!state) {
    return <div className="loading">Carregando…</div>
  }

  const setCollage = (next: CollageState) =>
    setState((s) => (s ? { ...s, collage: next } : s))
  const setLogo = (next: LogoState) =>
    setState((s) => (s ? { ...s, logo: next } : s))

  const resetCollage = () => {
    if (!confirm('Limpar a colagem e começar um projeto novo?')) return
    const next: AppState = { ...state, collage: defaultCollage() }
    setState(next)
    setSelection(null)
    void pruneImages(usedImageKeys(next))
  }

  const resetLogo = () => {
    const next: AppState = { ...state, logo: defaultLogo() }
    setState(next)
    void pruneImages(usedImageKeys(next))
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Cover Studio
          <span className="brand-sub">edição local · nada sai do navegador</span>
        </div>
        <nav className="tabs">
          <button
            type="button"
            className={state.tab === 'collage' ? 'active' : ''}
            onClick={() => setState({ ...state, tab: 'collage' })}
          >
            Colagem
          </button>
          <button
            type="button"
            className={state.tab === 'logo' ? 'active' : ''}
            onClick={() => setState({ ...state, tab: 'logo' })}
          >
            Logo redonda
          </button>
        </nav>
      </header>

      {state.tab === 'collage' ? (
        <main className="workspace">
          <CollageEditor
            value={state.collage}
            onChange={setCollage}
            selection={selection}
            onSelect={setSelection}
          />
          <aside className="sidebar">
            <CollageControls
              value={state.collage}
              onChange={setCollage}
              selection={selection}
              onSelect={setSelection}
              onReset={resetCollage}
            />
          </aside>
        </main>
      ) : (
        <main className="workspace">
          <LogoEditor value={state.logo} onChange={setLogo} onReset={resetLogo} />
        </main>
      )}
    </div>
  )
}
