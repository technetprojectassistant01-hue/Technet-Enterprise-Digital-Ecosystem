/**
 * Service worker for Technet Digital.
 *
 * Its only job today is Web Push: showing the 08:15 check-in reminder on a device whose browser
 * is closed. It deliberately does NOT cache anything - offline support is a separate, scoped
 * piece of work that is still waiting on the manager to confirm what "offline" needs to mean
 * (CLAUDE.md §13 item 5). Adding caching here by accident would ship a half-considered offline
 * mode and, worse, start serving stale application code.
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
