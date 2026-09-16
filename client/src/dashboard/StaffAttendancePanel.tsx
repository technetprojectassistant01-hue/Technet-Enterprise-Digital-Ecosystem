import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import * as api from '../lib/api'
import type { SiteAttendanceWithEmployee } from '../lib/api'
import { Panel, TableSkeleton, Badge } from './ui'
import { clockOf } from '../lib/siteAttendance'
import { useT } from '../i18n'

function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * The admin landing page's attendance panel. An admin administers the website rather than
 * visiting sites, so they get everybody else's check-ins for today instead of a check-in card of
 * their own. Team Attendance (Operations) remains the full month-by-month register — this is the
 * at-a-glance version, and links there.
 *
 * Built on the existing OPS_MANAGE_ROLES team endpoint with today as the range, so it needs no new
 * API. Grouped per person because one member of staff checks in several times a day as they move
 * between sites (CLAUDE.md §7a — there is no daily limit).
 */
function StaffAttendancePanel() {
  const t = useT()
  const [visits, setVisits] = useState<SiteAttendanceWithEmployee[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // The whole month, not just today: on a quiet morning a today-only panel is blank, which tells
    // an admin nothing. The day actually shown is picked below.
    api
      .listTeamAttendance({})
      .then(({ history }) => {
        if (cancelled) return
        setVisits(history)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t.staffAttendance.loadFailed)
      })
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function shown(declared: string | null, recordedIso: string): string {
    return declared || clockOf(new Date(recordedIso))
  }

  // Today when anyone has checked in, otherwise the most recent day that has records — so the
  // panel still says something useful before the first check-in of the morning.
  const shownDay = (() => {
    if (!visits || visits.length === 0) return null
    const today = dayKey(new Date())
    const days = new Set(visits.map((v) => dayKey(new Date(v.checkInAt))))
    if (days.has(today)) return today
    return Array.from(days).sort().pop() ?? null
  })()
  const isToday = shownDay === dayKey(new Date())

  // One row per person, their visits oldest-first so the day reads in order.
  const people = (() => {
    if (!visits || !shownDay) return []
    const byEmployee = new Map<string, { name: string; position: string | null; visits: SiteAttendanceWithEmployee[] }>()
    for (const v of visits) {
      if (!v.employee) continue
      if (dayKey(new Date(v.checkInAt)) !== shownDay) continue
      const key = v.employee.id
      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          name: `${v.employee.firstName} ${v.employee.lastName}`.trim(),
          position: v.employee.position ?? null,
          visits: [],
        })
      }
      byEmployee.get(key)!.visits.push(v)
    }
    for (const p of byEmployee.values()) {
      p.visits.sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime())
    }
    return Array.from(byEmployee.values()).sort((a, b) => a.name.localeCompare(b.name))
  })()

  const stillIn = people.reduce((n, p) => n + p.visits.filter((v) => !v.checkOutAt).length, 0)

  return (
    <Panel
      title={t.staffAttendance.title}
      icon={Users}
      action={
        <Link to="/dashboard/operations/team-attendance" className="text-xs font-semibold text-cyan-accent hover:underline">
          {t.staffAttendance.viewFull}
        </Link>
      }
    >
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!error && visits === null && <TableSkeleton rows={3} cols={3} />}
      {!error && visits !== null && people.length === 0 && (
        <p className="text-sm text-ink-300">{t.staffAttendance.empty}</p>
      )}
      {!error && visits !== null && people.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-ink-400">
            <span>{t.staffAttendance.peopleToday(people.length)}</span>
            {/* Reuses My Attendance's "Today" wording rather than adding a fourth way to say it. */}
            {isToday && <span className="text-ink-300">{t.myAttendance.todayTitle}</span>}
            {!isToday && shownDay && (
              <span className="text-ink-300">
                {t.staffAttendance.latestDay(new Date(`${shownDay}T00:00:00`).toLocaleDateString())}
              </span>
            )}
            {stillIn > 0 && <Badge tone="accent">{t.staffAttendance.onSiteNow(stillIn)}</Badge>}
          </div>
          <ul className="flex flex-col gap-2">
            {people.map((p) => (
              <li key={p.name} className="rounded-lg border border-ink-800 bg-ink-950 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-sm font-semibold text-ink-100">{p.name}</span>
                  {p.position && <span className="text-xs text-ink-400">{p.position}</span>}
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {p.visits.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="font-mono text-sm text-ink-100">
                        {shown(v.checkInDeclaredTime, v.checkInAt)}
                        <span className="px-1 text-ink-400">→</span>
                        {v.checkOutAt ? (
                          shown(v.checkOutDeclaredTime, v.checkOutAt)
                        ) : (
                          <span className="font-sans text-xs font-semibold text-cyan-accent">
                            {t.staffAttendance.stillIn}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 truncate text-ink-300">
                        {[v.checkInSite, v.checkInNote].filter(Boolean).join(' — ') || t.staffAttendance.noSite}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

export default StaffAttendancePanel
