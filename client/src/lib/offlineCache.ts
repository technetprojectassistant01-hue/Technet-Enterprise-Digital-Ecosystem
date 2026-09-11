/**
 * Clears the service worker's cached API responses (see public/sw.js). Called on logout so the
 * next person to sign in on the same device can't see the previous user's cached work orders or
 * schedule while offline. The app shell cache is kept — it holds only the app's own code, no
 * user data, and dropping it would stop the app opening offline until it was next loaded online.
 * The offline outbox (lib/outbox.ts) is deliberately left alone too: it may hold field work that
 * hasn't synced yet, and losing that is the one thing this whole feature exists to prevent.
 */
export async function clearOfflineCaches(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k.startsWith('technet-api-')).map((k) => caches.delete(k)))
  } catch {
    // Nothing we can do, and not worth blocking logout over.
  }
}
