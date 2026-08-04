import { useEffect, useState } from 'react'
import { Lock, MapPin } from 'lucide-react'
import * as api from '../lib/api'
import type { SiteAttendanceWithEmployee } from '../lib/api'
import { Panel, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_MANAGE_ROLES } from '../lib/permissions'
import { mapLink } from '../lib/geolocation'

function TeamAttendancePage() {
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, OPS_MANAGE_ROLES)

  const [current, setCurrent] = useState<SiteAttendanceWithEmployee[]>([])
  const [history, setHistory] = useState<SiteAttendanceWithEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canAccess) return
    api
      .listTeamAttendance()
      .then(({ current, history }) => {
        setCurrent(current)
        setHistory(history)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load attendance'))
      .finally(() => setLoading(false))
  }, [canAccess])

  if (!canAccess) {
    return <EmptyState icon={Lock} message="This section is restricted to Operations management." />
  }

  if (loading) return <TableSkeleton rows={6} cols={3} />
  if (error) return <EmptyState icon={MapPin} message={error} />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Team Attendance</h1>
        <p className="mt-1 text-sm text-ink-300">
          GPS-based daily check-in/out for field technicians, independent of any specific work order.
        </p>
      </div>

      <Panel title="Currently Checked In">
        {current.length === 0 ? (
          <p className="text-sm text-ink-400">Nobody is currently checked in.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {current.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg bg-ink-800 px-4 py-2.5"
              >
                <div>
                  <div className="text-sm font-medium text-ink-100">
                    {v.employee?.firstName} {v.employee?.lastName}
                    {v.employee?.position && <span className="text-ink-500"> · {v.employee.position}</span>}
                  </div>
                  <div className="text-xs text-ink-400">
                    Since {new Date(v.checkInAt).toLocaleString()}
                  </div>
                </div>
                <a
                  href={mapLink(v.checkInLat, v.checkInLng)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-cyan-accent hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  View location
                </a>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Recent Check-Ins">
        {history.length === 0 ? (
          <p className="text-sm text-ink-400">No check-ins recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">TECHNICIAN</th>
                  <th className="px-3 py-3 font-semibold">CHECK-IN</th>
                  <th className="px-3 py-3 font-semibold">CHECK-OUT</th>
                </tr>
              </thead>
              <tbody>
                {history.map((v) => (
                  <tr key={v.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-100">
                      {v.employee?.firstName} {v.employee?.lastName}
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      <a
                        href={mapLink(v.checkInLat, v.checkInLng)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-cyan-accent hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {new Date(v.checkInAt).toLocaleString()}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      {v.checkOutAt && v.checkOutLat && v.checkOutLng ? (
                        <a
                          href={mapLink(v.checkOutLat, v.checkOutLng)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-cyan-accent hover:underline"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          {new Date(v.checkOutAt).toLocaleString()}
                        </a>
                      ) : (
                        <span className="text-ink-500">Still checked in</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

export default TeamAttendancePage
