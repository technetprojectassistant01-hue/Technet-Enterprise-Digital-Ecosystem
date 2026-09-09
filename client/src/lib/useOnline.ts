import { useEffect, useRef, useState } from 'react'

/** Tracks `navigator.onLine`, updating on the browser's online/offline events. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

/**
 * Runs `reload` once each time the connection is regained. For a list page that fetched its data
 * once on mount: without this, a page opened offline (or left open while the signal dropped) keeps
 * showing the stale copy — or a stale error — until a manual refresh.
 */
export function useReloadOnReconnect(reload: () => void): void {
  const ref = useRef(reload)
  ref.current = reload
  useEffect(() => {
    const handler = () => ref.current()
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  }, [])
}
