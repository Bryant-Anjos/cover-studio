// Tiny promise wrapper over IndexedDB. Two stores: `images` (Blob by key) and
// `meta` (the serialisable app state under the key "state").

const DB_NAME = 'cover-studio'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images')
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const req = fn(tx.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const idbPut = (store: string, key: string, value: unknown) =>
  run<IDBValidKey>(store, 'readwrite', (s) => s.put(value as never, key))

export const idbGet = <T>(store: string, key: string) =>
  run<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>)

export const idbDelete = (store: string, key: string) =>
  run<undefined>(store, 'readwrite', (s) => s.delete(key) as IDBRequest<undefined>)

export function idbEntries(store: string): Promise<{ key: string; value: unknown }[]> {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly')
        const os = tx.objectStore(store)
        const out: { key: string; value: unknown }[] = []
        const cur = os.openCursor()
        cur.onsuccess = () => {
          const c = cur.result
          if (c) {
            out.push({ key: String(c.key), value: c.value })
            c.continue()
          } else {
            resolve(out)
          }
        }
        cur.onerror = () => reject(cur.error)
      }),
  )
}
