/**
 * Service worker for Technet Digital.
 *
 * Three jobs:
 *
 *  1. Web Push: showing the 08:15 check-in reminder on a device whose browser is closed.
 *  2. Background Sync: flushing the offline outbox (see src/lib/outbox.ts) when the connection
 *     returns, even if the app isn't open. This is a Chromium-only bonus — Safari has no
 *     Background Sync, so on iOS the app's own foreground flush is the only sync path. The API
 *     is same-origin (the Cloudflare Worker proxy) and the auth cookie first-party, so a fetch
 *     from here carries it like any page request.
 *  3. Offline reads: caching the app shell and the technician's own data (their work orders,
 *     schedule, assets) so those screens still open with no signal (CLAUDE.md §13 item 5,
 *     Milestone 2). The whole shell is saved at install, so the app opens offline even if it was
 *     only ever loaded once. Navigations and API reads are network-first, so an online device
 *     always gets the latest — the cache is only a fallback.
 *
 * Dev note: this runs on localhost too. Navigation is network-first so Vite HMR is unaffected;
 * if HMR ever misbehaves, DevTools → Application → Service Workers → Unregister.
 */

// Both lines are rewritten on every production build by the sw-build-stamp plugin in
// vite.config.ts (the build fails if it can't find them — keep them exactly as written). The
// build id makes this file's bytes change on each deploy, which is the only thing that makes a
// browser pick up a new worker and the app show its "new version" bar. Left as-is in dev.
const BUILD_ID = 'dev'
const PRECACHE_URLS = []

// The shell cache is per build: a new deploy saves a fresh copy and the old one is dropped on
// activate. The API cache is NOT per build — wiping it on every deploy would throw away a
// technician's saved jobs the moment an update landed. Bump this only if its format changes.
const API_CACHE_VERSION = 'v5'
const SHELL_CACHE = `technet-shell-${BUILD_ID}`
const API_CACHE = `technet-api-${API_CACHE_VERSION}`

// GET paths whose responses are worth keeping for offline viewing — the technician-facing data,
// not the whole API. Matched by path only, so it works whatever origin the API is served from.
const CACHEABLE_API = [
  /^\/api\/auth\/me$/,
  /^\/api\/site-attendance\/me$/,
  /^\/api\/work-orders(\/[^/]+)?$/,
  /^\/api\/daily-reports$/,
  /^\/api\/intervention-reports(\/[^/]+)?$/,
  /^\/api\/maintenance-schedules(\/[^/]+)?$/,
  /^\/api\/maintenance-assets\/[^/]+$/,
  /^\/api\/customers$/,
  /^\/api\/employees$/,
]

/**
 * Save the whole app shell up front. Without this the shell was only cached by the *next* page
 * load after the worker took over, so someone who installed the app and lost signal before
 * opening it a second time got the browser's offline page instead of the app.
 */
async function precacheShell() {
  if (!PRECACHE_URLS.length) return // dev build — nothing stamped in, runtime caching still works
  const cache = await caches.open(SHELL_CACHE)
  // Fetched as '/' because Cloudflare redirects /index.html → /, and a redirected response can't
  // answer a navigation. Stored under the '/index.html' key the navigation fallback reads.
  const shell = await fetch('/', { cache: 'reload' })
  if (!shell.ok) throw new Error(`Shell fetch failed: ${shell.status}`)
  await cache.put('/index.html', shell)
  await cache.addAll(PRECACHE_URLS)
}

self.addEventListener('install', (event) => {
  // Take over as soon as the shell is saved rather than waiting for every old tab to close, so a
  // technician who enables reminders gets a worker that can receive them without reopening the
  // app. The open page then shows its "new version — Reload" bar (src/lib/appUpdate.ts).
  self.skipWaiting()
  event.waitUntil(precacheShell())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, API_CACHE])
      for (const key of await caches.keys()) {
        if (key.startsWith('technet-') && !keep.has(key)) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      /\.(?:js|css|woff2?|ttf|png|svg|ico|webmanifest)$/.test(url.pathname))
  )
}

function isCacheableApi(url) {
  return url.pathname.startsWith('/api/') && CACHEABLE_API.some((re) => re.test(url.pathname))
}

/** Network-first: fresh when online, last-cached when not. Used for navigations and API reads. */
async function networkFirst(request, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res.ok) cache.put(fallbackKey || request, res.clone())
    return res
  } catch (e) {
    const cached = await cache.match(fallbackKey || request)
    if (cached) return cached
    throw e
  }
}

/** Serve from cache immediately, refresh in the background. Used for hashed static assets. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => null)
  return cached || (await network) || fetch(request)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // never cache a mutation

  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    // The SPA shell — Cloudflare serves index.html for any client route.
    event.respondWith(networkFirst(request, SHELL_CACHE, '/index.html'))
    return
  }
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }
  if (isCacheableApi(url)) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }
  // Everything else (binary photo downloads, non-listed endpoints, other origins): untouched.
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
      icon: '/icon-192.png',
      badge: '/icon-192.png',
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
  // item.url is relative in production (same-origin API via the Worker), absolute in local dev.
  const photosUrl =
    new URL(item.url, self.location.origin).origin +
    '/api/intervention-reports/' +
    progress.reportId +
    '/photos'
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
