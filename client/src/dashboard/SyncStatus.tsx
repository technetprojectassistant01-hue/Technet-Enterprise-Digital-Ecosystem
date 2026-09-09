import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { flushOutbox, listOutbox, subscribeOutbox, type OutboxItem } from '../lib/outbox'
import { useOnline } from '../lib/useOnline'
import { Modal } from './ui'

/**
 * Header indicator for the offline outbox (lib/outbox). Shows nothing when the device is online
 * and nothing is queued; a plain "Offline" pill when the connection drops; and a count when
 * field submissions are waiting to sync. Opening it explains what's happening in plain terms —
 * the technician's own screens deliberately don't dwell on the tracking side of attendance, but
 * "your work is saved and will upload itself" is reassurance, not monitoring.
 */
function SyncStatus() {
  const online = useOnline()
  const [items, setItems] = useState<OutboxItem[]>([])
  const [open, setOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const refresh = () => listOutbox().then(setItems)
    refresh()
    return subscribeOutbox(refresh)
  }, [])

  if (online && items.length === 0) return null

  async function tryNow() {
    setSyncing(true)
    try {
      await flushOutbox()
    } finally {
      setSyncing(false)
    }
  }

  const label = items.length > 0 ? `${items.length} waiting to sync` : 'Offline'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900 px-2.5 py-1 text-xs text-ink-300 hover:text-ink-100"
      >
        {online ? (
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-cyan-accent' : ''}`} />
        ) : (
          <CloudOff className="h-3.5 w-3.5 text-amber-400" />
        )}
        {label}
      </button>

      {open && (
        <Modal title="Waiting to sync" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-300">
              {online
                ? 'These field entries are saved on this device and will upload on their own. You can also sync them now.'
                : "You're offline. Anything you save is kept on this device and uploads automatically once you're back online — you don't need to re-enter it."}
            </p>

            {items.length === 0 ? (
              <p className="text-sm text-ink-400">Nothing waiting.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-ink-800 px-3 py-2 text-sm"
                  >
                    <span className="text-ink-200">{item.label}</span>
                    <span className="shrink-0 text-xs text-ink-500">
                      {item.lastError
                        ? item.lastError
                        : item.attempts > 0
                          ? `retried ${item.attempts}×`
                          : 'saved'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={tryNow}
              disabled={!online || syncing || items.length === 0}
              className="self-start rounded-md border border-ink-700 px-3 py-1.5 text-sm text-ink-200 hover:text-ink-100 disabled:opacity-40"
            >
              {syncing ? 'Syncing…' : 'Try now'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

export default SyncStatus
