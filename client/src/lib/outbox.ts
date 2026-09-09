/**
 * Offline outbox for technician field submissions.
 *
 * The manager's ask (CLAUDE.md §13 item 5): when a technician loses signal on a job, their
 * check-in or report must not be lost — it saves on the device and uploads on its own when the
 * connection comes back, with no re-typing. This module is that mechanism.
 *
 * How it works: the five field submissions (check-in, check-out, daily report, maintenance
 * report, intervention report) go through `submitOrQueue` instead of calling the API directly.
 * If the network is up, it behaves exactly like a normal call. If the request fails because the
 * device is offline, the payload is written to IndexedDB and `submitOrQueue` returns
 * `{ queued: true }` so the screen can tell the technician it's saved. `flushOutbox` then
 * replays queued items — on the `online` event, on app start, and on a 60s timer while a tab
 * is open. On iOS that timer/event is the only sync path (Safari has no background sync); on
 * Android a Service Worker Background Sync can also flush while the app is closed (see sw.js).
 *
 * Every queued submission carries a stable `clientRequestId` (its outbox id). The server records
 * it in `ProcessedRequest` so a replay of a request that already landed is a no-op rather than a
 * duplicate — see server/src/lib/idempotency.ts.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export type OutboxKind =
  | 'check-in'
  | 'check-out'
  | 'daily-report'
  | 'maintenance-report'
  | 'intervention-report'

export interface OutboxPhoto {
  id: string
  kind: string
  fileData: string
  fileName: string
}

export interface OutboxItem {
  /** Also the clientRequestId sent to the server. */
  id: string
  kind: OutboxKind
  /** Short human summary for the sync indicator, e.g. "Daily report — 9 Sep". */
  label: string
  createdAt: number
  attempts: number
  lastError?: string
  /** The main POST to replay — an absolute URL, so the service worker can replay it too. */
  url: string
  body: Record<string, unknown>
  /** Intervention reports only: the follow-up photo uploads. */
  photos?: OutboxPhoto[]
  /** Intervention reports only: how far a replay has got. */
  progress?: { reportId: string; photosDone: number }
}

// --- IndexedDB (hand-rolled; the codebase avoids adding a dependency for this) -------------

const DB_NAME = 'technet-outbox'
const STORE = 'pending'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Runs one transaction. A write resolves only once the transaction has *committed* — not merely
 * when the request succeeded — so a read on a following transaction always sees it. The
 * "N waiting to sync" count was undercounting because it could read between a put's success and
 * its commit.
 */
async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = fn(tx.objectStore(STORE))
      let result: T
      request.onsuccess = () => {
        result = request.result as T
      }
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => resolve(result)
      tx.onabort = () => reject(tx.error ?? request.error)
    })
  } finally {
    db.close()
  }
}

/** Pending items, oldest first — replay order matters (a check-in must land before its check-out). */
export async function listOutbox(): Promise<OutboxItem[]> {
  try {
    const all = await run<OutboxItem[]>('readonly', (s) => s.getAll())
    return all.sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    // A private-mode browser or blocked storage: nothing queued, and nothing we can do about it.
    return []
  }
}

async function putItem(item: OutboxItem): Promise<void> {
  await run('readwrite', (s) => s.put(item))
  emit()
}

async function removeItem(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id))
  emit()
}

// --- Change notifications for the sync indicator ------------------------------------------

type Listener = () => void
const listeners = new Set<Listener>()

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function emit(): void {
  for (const l of listeners) l()
}

/** Wired to the toast system in App.tsx — the lib itself has no React context. */
let onDrop: ((item: OutboxItem) => void) | null = null
export function setOutboxDropHandler(fn: (item: OutboxItem) => void): void {
  onDrop = fn
}

// --- HTTP (no throw; the caller needs the status code) ------------------------------------

interface RawResult {
  ok: boolean
  status: number
  data: { error?: string; [k: string]: unknown } | null
  networkError: boolean
}

async function post(url: string, body: unknown): Promise<RawResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) as RawResult['data']
    return { ok: res.ok, status: res.status, data, networkError: false }
  } catch {
    return { ok: false, status: 0, data: null, networkError: true }
  }
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

// --- Submitting -------------------------------------------------------------------------

export interface QueueResult<T> {
  /** true when the submission was saved for later instead of sent now. */
  queued: boolean
  /** The server response, when there was one. */
  data?: T
}

export interface SubmitSpec {
  kind: OutboxKind
  label: string
  /** API path, e.g. "/api/daily-reports". */
  endpoint: string
  body: Record<string, unknown>
  /** Intervention reports only. */
  photos?: { kind: string; fileData: string; fileName: string }[]
}

const photosUrl = (reportId: string) => `${API_URL}/api/intervention-reports/${reportId}/photos`

/**
 * Sends a field submission, or saves it to the outbox if the device is offline. Throws (exactly
 * like a normal API call) only when a reachable server rejects the request — a validation error
 * still needs to reach the technician.
 */
export async function submitOrQueue<T>(spec: SubmitSpec): Promise<QueueResult<T>> {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const body = { ...spec.body, clientRequestId: id }
  const photos: OutboxPhoto[] = (spec.photos ?? []).map((p) => ({
    ...p,
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${id}-${Math.random().toString(36).slice(2)}`,
  }))

  const url = `${API_URL}${spec.endpoint}`
  const enqueue = (progress?: OutboxItem['progress']) =>
    putItem({
      id,
      kind: spec.kind,
      label: spec.label,
      createdAt: Date.now(),
      attempts: 0,
      url,
      body,
      photos: photos.length ? photos : undefined,
      progress,
    })

  if (isOffline()) {
    await enqueue()
    void requestBackgroundSync()
    return { queued: true }
  }

  const res = await post(url, body)
  if (res.networkError) {
    await enqueue()
    void requestBackgroundSync()
    return { queued: true }
  }
  if (!res.ok) {
    throw new Error(res.data?.error || `Request failed (${res.status})`)
  }

  // Intervention reports: the create succeeded; now the photos, each its own request.
  if (spec.kind === 'intervention-report' && photos.length) {
    const reportId = (res.data as { interventionReport?: { id?: string } } | null)?.interventionReport?.id
    if (reportId) {
      for (let i = 0; i < photos.length; i += 1) {
        const p = photos[i]
        const pr = await post(photosUrl(reportId), {
          kind: p.kind,
          fileData: p.fileData,
          fileName: p.fileName,
          clientRequestId: p.id,
        })
        if (pr.networkError) {
          await enqueue({ reportId, photosDone: i })
          void requestBackgroundSync()
          return { queued: true, data: res.data as T }
        }
        // A 4xx on one photo isn't worth failing the whole report over — skip it.
      }
    }
  }

  return { queued: false, data: res.data as T }
}

// --- Flushing --------------------------------------------------------------------------

type ReplayOutcome = 'done' | 'drop' | 'auth' | { retry: string }

function classify(res: RawResult): ReplayOutcome | 'ok' {
  if (res.networkError) return { retry: 'No connection' }
  if (res.status === 401) return 'auth'
  if (res.status === 408 || res.status === 429 || res.status >= 500) {
    return { retry: `Server busy (${res.status})` }
  }
  if (!res.ok) return 'drop' // a 4xx won't fix itself on retry
  return 'ok'
}

async function replay(item: OutboxItem): Promise<ReplayOutcome> {
  let progress = item.progress

  if (!progress) {
    const res = await post(item.url, item.body)
    const verdict = classify(res)
    if (verdict !== 'ok') return verdict

    if (item.kind !== 'intervention-report') return 'done'

    const reportId = (res.data as { interventionReport?: { id?: string } } | null)?.interventionReport
      ?.id
    if (!reportId) return { retry: 'Waiting for the report to sync' }
    if (!item.photos?.length) return 'done'
    progress = { reportId, photosDone: 0 }
    await putItem({ ...item, progress })
  }

  const photos = item.photos ?? []
  for (let i = progress.photosDone; i < photos.length; i += 1) {
    const p = photos[i]
    const res = await post(photosUrl(progress.reportId), {
      kind: p.kind,
      fileData: p.fileData,
      fileName: p.fileName,
      clientRequestId: p.id,
    })
    const verdict = classify(res)
    if (verdict === 'auth') return 'auth'
    if (typeof verdict === 'object') return verdict // network / server — resume here later
    // 'ok' or 'drop' (a rejected photo): either way, move past it.
    progress = { reportId: progress.reportId, photosDone: i + 1 }
    await putItem({ ...item, progress })
  }
  return 'done'
}

let flushing = false

/** Replays every queued submission. Safe to call often; a run in progress is not doubled up. */
export async function flushOutbox(): Promise<void> {
  if (flushing || isOffline()) return
  flushing = true
  try {
    for (const item of await listOutbox()) {
      let outcome: ReplayOutcome
      try {
        outcome = await replay(item)
      } catch {
        outcome = { retry: 'Unexpected error' }
      }

      if (outcome === 'done') {
        await removeItem(item.id)
      } else if (outcome === 'drop') {
        // Permanently rejected (a 4xx). Remove it and carry on — but tell the technician,
        // because for them the entry looked saved.
        await removeItem(item.id)
        onDrop?.(item)
      } else {
        // 'auth' or a transient failure. Stop the pass rather than pressing on: the queue is
        // replayed in order and a later entry often depends on an earlier one (a check-out on
        // its check-in), and a real outage would fail the rest the same way.
        if (outcome !== 'auth') {
          await putItem({ ...item, attempts: item.attempts + 1, lastError: outcome.retry })
        }
        break
      }
    }
  } finally {
    flushing = false
    emit()
  }
}

async function requestBackgroundSync(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.ready
    // `sync` is Chromium-only; where it exists the SW can flush with the app closed.
    await (reg as unknown as { sync?: { register(tag: string): Promise<void> } })?.sync?.register(
      'outbox-flush',
    )
  } catch {
    // No Background Sync (Safari, or permission denied) — the foreground triggers cover it.
  }
}

let started = false

/** Called once at app start: initial flush, plus flush on reconnect and on a slow timer. */
export function startOutbox(): void {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('online', () => void flushOutbox())
  window.addEventListener('offline', emit)
  setInterval(() => void flushOutbox(), 60_000)
  void flushOutbox()
}
