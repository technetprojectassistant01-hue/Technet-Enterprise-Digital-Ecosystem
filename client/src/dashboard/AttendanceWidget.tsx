import { useEffect, useState } from 'react'
import { LogIn, LogOut, MapPin } from 'lucide-react'
import * as api from '../lib/api'
import type { SiteAttendance } from '../lib/api'
import { getPosition, mapLink } from '../lib/geolocation'
import { Panel } from './ui'
import { primaryButtonClass, secondaryButtonClass } from './buttonStyles'
import { useToast } from './ToastContext'

function AttendanceWidget() {
  const toast = useToast()
  const [current, setCurrent] = useState<SiteAttendance | null>(null)
  const [history, setHistory] = useState<SiteAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(false)

  function load() {
    setLoading(true)
    api
      .getMyAttendance()
      .then(({ current, history }) => {
        setCurrent(current)
        setHistory(history)
      })
      .catch(() => {
        setCurrent(null)
        setHistory([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleCheckIn() {
    setActioning(true)
    try {
      const pos = await getPosition()
      await api.checkInAttendance({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      toast.success('Checked in')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to check in')
    } finally {
      setActioning(false)
    }
  }

  async function handleCheckOut() {
    setActioning(true)
    try {
      const pos = await getPosition()
      await api.checkOutAttendance({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      toast.success('Checked out')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to check out')
    } finally {
      setActioning(false)
    }
  }

  if (loading) return null

  return (
    <Panel title="My Attendance">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {current ? (
              <p className="text-sm text-ink-100">
                Checked in since {new Date(current.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            ) : (
              <p className="text-sm text-ink-400">Not checked in</p>
            )}
          </div>
          {current ? (
            <button type="button" onClick={handleCheckOut} disabled={actioning} className={secondaryButtonClass}>
              <LogOut className="h-4 w-4" />
              Check Out
            </button>
          ) : (
            <button type="button" onClick={handleCheckIn} disabled={actioning} className={primaryButtonClass}>
              <LogIn className="h-4 w-4" />
              Check In
            </button>
          )}
        </div>

        {history.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-ink-800 pt-3">
            {history.slice(0, 5).map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 text-xs text-ink-400">
                <a
                  href={mapLink(v.checkInLat, v.checkInLng)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-cyan-accent hover:underline"
                >
                  <MapPin className="h-3 w-3" />
                  {new Date(v.checkInAt).toLocaleString()}
                </a>
                <span>
                  {v.checkOutAt ? (
                    <a
                      href={v.checkOutLat && v.checkOutLng ? mapLink(v.checkOutLat, v.checkOutLng) : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-cyan-accent hover:underline"
                    >
                      → {new Date(v.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </a>
                  ) : (
                    'Still checked in'
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}

export default AttendanceWidget
