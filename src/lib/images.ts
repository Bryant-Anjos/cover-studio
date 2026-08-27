// In-memory image cache backed by IndexedDB. Components subscribe so the canvas
// re-renders when a picture finishes decoding.

import { idbDelete, idbEntries, idbPut } from './idb'

interface Entry {
  blob: Blob
  url: string
  img: HTMLImageElement | null
}

const cache = new Map<string, Entry>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version++
  listeners.forEach((l) => l())
}

export function subscribeImages(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const imagesVersion = () => version

export function getImage(key: string): HTMLImageElement | null {
  return cache.get(key)?.img ?? null
}

export function hasImage(key: string): boolean {
  return cache.get(key)?.img != null
}

function hydrate(key: string, blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob)
  const entry: Entry = { blob, url, img: null }
  cache.set(key, entry)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      entry.img = img
      emit()
      resolve()
    }
    img.onerror = () => resolve()
    img.src = url
  })
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

export async function addImageFile(file: Blob): Promise<string> {
  const key = uid()
  await idbPut('images', key, file)
  await hydrate(key, file)
  return key
}

export async function loadImagesFromIdb(): Promise<void> {
  const rows = await idbEntries('images')
  await Promise.all(
    rows.map((r) => hydrate(r.key, r.value as Blob)),
  )
  emit()
}

export async function forgetImage(key: string): Promise<void> {
  const e = cache.get(key)
  if (e) URL.revokeObjectURL(e.url)
  cache.delete(key)
  await idbDelete('images', key)
  emit()
}

/** Remove any stored images no longer referenced by the given key set. */
export async function pruneImages(usedKeys: Set<string>): Promise<void> {
  const rows = await idbEntries('images')
  await Promise.all(
    rows
      .filter((r) => !usedKeys.has(r.key))
      .map((r) => idbDelete('images', r.key)),
  )
}
