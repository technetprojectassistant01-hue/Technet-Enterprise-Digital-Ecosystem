const DB_NAME = 'technet-pending-nav'
const STORE = 'pending'
const KEY = 'target'
/** Older than this, the entry is treated as stale (an unrelated later app open) rather than acted on. */
const MAX_AGE_MS = 10 * 60 * 1000

interface PendingNav {
  url: string
  savedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Reads and clears the pending navigation target left by the service worker's
 * `notificationclick` handler (see `public/sw.js`), if any.
 *
 * Why this exists: iOS ignores the URL passed to `clients.openWindow()` when the installed home
 * screen app isn't already running - it cold-launches at the manifest's `start_url` (`/dashboard`)
 * instead, regardless of what the notification asked for. Every push before the attendance-audit
 * feature happened to point at `/dashboard` anyway, so this was invisible until a notification
 * needed to deep-link somewhere else. The service worker stashes the real target in IndexedDB
 * before attempting to open/focus a window; this is the app-side half that redirects there once
 * the app actually boots, working around the platform limitation instead of fighting it.
 */
export async function consumePendingNavTarget(): Promise<string | null> {
  try {
    const db = await openDb()
    const value = await new Promise<PendingNav | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const getReq = store.get(KEY)
      getReq.onsuccess = () => {
        const found = getReq.result as PendingNav | undefined
        if (found) store.delete(KEY)
        resolve(found)
      }
      getReq.onerror = () => reject(getReq.error)
    })
    db.close()
    if (!value) return null
    if (Date.now() - value.savedAt > MAX_AGE_MS) return null
    return value.url
  } catch {
    return null
  }
}
