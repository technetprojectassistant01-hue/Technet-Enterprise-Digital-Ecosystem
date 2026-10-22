import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Keeps what someone has typed into a NEW-record form (Add Customer, New Work Order, ...) on the
 * device, so closing the window, the app or the pop-up by mistake doesn't lose it. Edit forms
 * don't use this on purpose: their content is already saved on the server.
 *
 * The draft is kept per signed-in person (shared devices), dropped after 30 days, and only while
 * it differs from the form's starting values. Files and photos can't be kept - say so with
 * DraftNotice's `files` prop.
 *
 * Use:
 *   const draft = useFormDraft('customer', form, showCreate)
 *   openCreate:  setForm(draft.take(EMPTY_FORM))
 *   on success:  draft.clear()
 *   banner:      {draft.restored && <DraftNotice onDiscard={() => setForm(draft.discard())} />}
 *
 * Closing the form without saving keeps the draft: a tap outside a pop-up closes it too, and that
 * is exactly the accident this guards against. "Discard draft" is the way to throw it away.
 */

const PREFIX = 'technet-draft'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

interface Stored<T> {
  savedAt: number
  value: T
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const stored = JSON.parse(raw) as Stored<T>
    if (!stored || typeof stored.savedAt !== 'number' || Date.now() - stored.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key)
      return null
    }
    return stored.value
  } catch {
    return null
  }
}

function removeDraft(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage blocked (private mode): nothing was saved either.
  }
}

export function useFormDraft<T>(name: string, value: T, active: boolean) {
  const { user } = useAuth()
  const key = user ? `${PREFIX}:${user.id}:${name}` : null
  const [restored, setRestored] = useState(false)
  // The form's starting values: a form still equal to them has nothing worth keeping.
  const baseline = useRef<string | null>(null)
  const fallback = useRef<T | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelPending = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => {
    if (!active || !key) return
    cancelPending()
    timer.current = setTimeout(() => {
      timer.current = null
      const json = JSON.stringify(value)
      try {
        if (json === baseline.current) localStorage.removeItem(key)
        else localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }))
      } catch {
        // Storage full or blocked: the form still works, it just isn't kept.
      }
    }, 400)
    return cancelPending
  }, [active, key, value, cancelPending])

  /** The saved draft merged over `start`, or `start` itself. Call it when the new form opens. */
  const take = useCallback(
    (start: T): T => {
      baseline.current = JSON.stringify(start)
      fallback.current = start
      const saved = key ? readDraft<T>(key) : null
      setRestored(saved !== null)
      if (saved === null) return start
      // Merge so a field added to the form since the draft was saved still gets its default.
      return isPlainObject(start) && isPlainObject(saved) ? ({ ...start, ...saved } as T) : saved
    },
    [key],
  )

  /** Forget the draft (after the record was saved). */
  const clear = useCallback(() => {
    cancelPending()
    if (key) removeDraft(key)
    setRestored(false)
  }, [key, cancelPending])

  /** Forget the draft and get the form's starting values back. */
  const discard = useCallback((): T => {
    clear()
    return fallback.current as T
  }, [clear])

  return { restored, take, clear, discard }
}
