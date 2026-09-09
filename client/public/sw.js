/**
 * Service worker for Technet Digital.
 *
 * Two jobs:
 *
 *  1. Web Push: showing the 08:15 check-in reminder on a device whose browser is closed.
 *  2. Background Sync: flushing the offline outbox (see src/lib/outbox.ts) when the connection
 *     returns, even if the app isn't open. This is a Chromium-only bonus — Safari has no
 *     Background Sync, so on iOS the app's own foreground flush is the only sync path. It is
 *     also unverified against production's cross-origin Partitioned auth cookie: a background
 *     fetch from here to the API's own origin may not carry the cookie. The foreground flush,
 *     which runs in the page where the cookie definitely works, is the guarantee; this only
 *     ever helps, never hurts.
 *
 * It still deliberately does NOT cache application code or pages — offline *reads* are a
 * separate piece of work (CLAUDE.md §13 item 5, Milestone 2). Adding caching here carelessly
 * would risk serving a stale build.
 */

self.addEventListener('install', () => {
  // Take over immediately rather than waiting for every old tab to close, so a technician who
  // enables reminders gets a worker that can actually receive them without reopening the app.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = { title: 'Technet Digital', body: '', url: '/dashboard', tag: undefined }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    // A push with a non-JSON body still deserves to surface rather than being dropped silently.
    if (event.data) payload.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      // Replaces a previous reminder instead of stacking a second one on the lock screen.
      renotify: Boolean(payload.tag),
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: payload.url || '/dashboard' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/dashboard'

  // Focus an already-open tab rather than opening a duplicate - a technician tapping the
  // reminder should land in the app they may already have running, not a second copy.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})

// --- Background Sync: flush the offline outbox ------------------------------------------------
//
// A compact re-implementation of src/lib/outbox.ts's flush, since a service worker can't import
// the app's modules. The record shape must stay in step with OutboxItem there.

const OUTBOX_DB = 'technet-outbox'
const OUTBOX_STORE = 'pending'

function openOutbox() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(OUTBOX_STORE)) {
        req.result.createObjectStore(OUTBOX_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idb(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const request = fn(db.transaction(OUTBOX_STORE, mode).objectStore(OUTBOX_STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function sendJson(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } catch (e) {
    return { ok: false, status: 0, data: null, networkError: true }
  }
}

/** Keep for a later attempt on network/auth/5xx; give up (and let the app surface it) on 4xx. */
function shouldRetry(res) {
  return res.networkError || res.status === 401 || res.status === 408 || res.status === 429 || res.status >= 500
}

async function replayItem(db, item) {
  let progress = item.progress
  if (!progress) {
    const res = await sendJson(item.url, item.body)
    if (shouldRetry(res)) return 'keep'
    if (!res.ok) return 'done' // 4xx — the app will show it on next open
    if (item.kind !== 'intervention-report') return 'done'
    const reportId = res.data && res.data.interventionReport && res.data.interventionReport.id
    if (!reportId) return 'keep'
    if (!item.photos || !item.photos.length) return 'done'
    progress = { reportId, photosDone: 0 }
    await idb(db, 'readwrite', (s) => s.put({ ...item, progress }))
  }

  const photos = item.photos || []
  const photosUrl = new URL(item.url).origin + '/api/intervention-reports/' + progress.reportId + '/photos'
  for (let i = progress.photosDone; i < photos.length; i += 1) {
    const p = photos[i]
    const res = await sendJson(photosUrl, {
      kind: p.kind,
      fileData: p.fileData,
      fileName: p.fileName,
      clientRequestId: p.id,
    })
    if (res.status === 401 || res.networkError || res.status >= 500) return 'keep'
    progress = { reportId: progress.reportId, photosDone: i + 1 }
    await idb(db, 'readwrite', (s) => s.put({ ...item, progress }))
  }
  return 'done'
}

async function flushOutbox() {
  const db = await openOutbox()
  const items = (await idb(db, 'readonly', (s) => s.getAll())) || []
  items.sort((a, b) => a.createdAt - b.createdAt)
  for (const item of items) {
    let outcome
    try {
      outcome = await replayItem(db, item)
    } catch (e) {
      outcome = 'keep'
    }
    if (outcome === 'done') {
      await idb(db, 'readwrite', (s) => s.delete(item.id))
    } else {
      // Stop on the first item that can't go through: order matters (a check-in before its
      // check-out), and a genuine outage will fail the rest the same way.
      break
    }
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'outbox-flush') {
    event.waitUntil(flushOutbox())
  }
})
