import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import * as api from '../lib/api'
import type { Notification } from '../lib/api'
import { Modal, EmptyState } from './ui'

const POLL_INTERVAL_MS = 60_000

function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  function refreshCount() {
    api
      .listNotifications()
      .then(({ unreadCount }) => setUnreadCount(unreadCount))
      .catch(() => {
        // A missed poll isn't worth surfacing an error for.
      })
  }

  useEffect(refreshCount, [])

  // Background poll for the unread count - not real-time, just a periodic check.
  useEffect(() => {
    const interval = setInterval(refreshCount, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  function openPanel() {
    setOpen(true)
    setLoading(true)
    api
      .listNotifications()
      .then(({ notifications, unreadCount }) => {
        setNotifications(notifications)
        setUnreadCount(unreadCount)
      })
      .catch(() => {
        // Panel just shows an empty state below if this fails.
      })
      .finally(() => setLoading(false))
  }

  function handleItemClick(notification: Notification) {
    // Close immediately rather than waiting on the network call below - otherwise, under a slow
    // connection, the modal stays open over whatever page the link just navigated to.
    if (notification.link) setOpen(false)
    if (!notification.readAt) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
      api.markNotificationRead(notification.id).catch(() => {})
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    setUnreadCount(0)
    await api.markAllNotificationsRead().catch(() => {})
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="relative text-ink-300 hover:text-ink-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-400 px-1 text-[10px] font-semibold text-ink-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <Modal
          title="Notifications"
          onClose={() => setOpen(false)}
          size="md"
        >
          <div className="flex flex-col gap-3">
            {unreadCount > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs font-medium text-cyan-accent hover:underline"
                >
                  Mark all read
                </button>
              </div>
            )}

            {loading ? (
              <p className="py-6 text-center text-sm text-ink-400">Loading…</p>
            ) : notifications.length === 0 ? (
              <EmptyState icon={Bell} message="No notifications yet." />
            ) : (
              <div className="flex flex-col gap-2">
                {notifications.map((n) => {
                  const isUnread = !n.readAt
                  const content = (
                    <div
                      className={`rounded-lg border-l-2 bg-ink-800 px-4 py-3 ${
                        isUnread ? 'border-cyan-accent' : 'border-ink-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`text-sm ${isUnread ? 'font-semibold text-ink-100' : 'text-ink-300'}`}>
                          {n.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-ink-500">
                          {new Date(n.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {n.message && <p className="mt-1 text-xs text-ink-400">{n.message}</p>}
                    </div>
                  )
                  return n.link ? (
                    <Link key={n.id} to={n.link} onClick={() => handleItemClick(n)}>
                      {content}
                    </Link>
                  ) : (
                    <button key={n.id} type="button" onClick={() => handleItemClick(n)} className="text-left">
                      {content}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}

export default NotificationBell
