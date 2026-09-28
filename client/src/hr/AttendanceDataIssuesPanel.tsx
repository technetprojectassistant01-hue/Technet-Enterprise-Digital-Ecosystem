import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import * as api from '../lib/api'
import type { AttendanceDataIssues } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useT } from '../i18n'

type Person = AttendanceDataIssues['inverted'][number]['employee']

/**
 * All-time attendance data-integrity report on HR's Overtime page: check-outs before check-ins,
 * overlapping sessions and overtime days over 12 hours. Read-only by design - nothing is corrected
 * automatically and approved overtime is never touched; HR fixes records by hand if they judge it
 * necessary. Times are shown in Mauritius time whatever the viewer's device timezone.
 */
function AttendanceDataIssuesPanel() {
  const t = useT()
  const copy = t.workforce.overtime.dataIssues
  const [data, setData] = useState<AttendanceDataIssues | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getAttendanceDataIssues()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : copy.loadFailed))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stamp = new Intl.DateTimeFormat(t.shared.dateLocale, {
    timeZone: 'Indian/Mauritius',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const when = (iso: string | null) => (iso ? stamp.format(new Date(iso)) : '—')
  const span = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    return h > 0 ? t.shared.hoursMinutes(h, minutes % 60) : t.shared.minutesOnly(minutes)
  }
  const person = (e: Person) =>
    e ? (
      <>
        <div className="font-medium text-ink-100">{`${e.firstName} ${e.lastName}`}</div>
        <div className="font-mono text-xs text-ink-400">{e.employeeCode}</div>
      </>
    ) : (
      '—'
    )

  const total = data ? data.inverted.length + data.overlapping.length + data.excessiveOvertime.length : 0

  return (
    <Panel
      title={copy.panel}
      icon={AlertTriangle}
      badge={data && total > 0 ? <Badge tone="warning">{total}</Badge> : undefined}
    >
      <p className="mb-4 text-sm text-ink-300">{copy.intro}</p>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {!data && !error ? (
        <TableSkeleton cols={4} />
      ) : data && total === 0 ? (
        <EmptyState icon={AlertTriangle} message={copy.allClear} />
      ) : data ? (
        <div className="flex flex-col gap-6">
          <Section title={copy.inverted} hint={copy.invertedHint} count={data.inverted.length} none={copy.none}>
            <thead>
              <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                <th className="px-3 py-2 font-semibold">{t.shared.employeeCol}</th>
                <th className="px-3 py-2 font-semibold">{copy.colIn}</th>
                <th className="px-3 py-2 font-semibold">{copy.colOut}</th>
              </tr>
            </thead>
            <tbody>
              {data.inverted.map((s) => (
                <tr key={s.id} className="border-b border-ink-800 align-top last:border-0">
                  <td className="px-3 py-2">{person(s.employee)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-100">{when(s.checkInAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-red-400">{when(s.checkOutAt)}</td>
                </tr>
              ))}
            </tbody>
          </Section>

          <Section title={copy.overlapping} hint={copy.overlappingHint} count={data.overlapping.length} none={copy.none}>
            <thead>
              <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                <th className="px-3 py-2 font-semibold">{t.shared.employeeCol}</th>
                <th className="px-3 py-2 font-semibold">{copy.colFirst}</th>
                <th className="px-3 py-2 font-semibold">{copy.colSecond}</th>
              </tr>
            </thead>
            <tbody>
              {data.overlapping.map((p) => (
                <tr key={`${p.first.id}|${p.second.id}`} className="border-b border-ink-800 align-top last:border-0">
                  <td className="px-3 py-2">{person(p.employee)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-100">{`${when(p.first.checkInAt)} → ${when(p.first.checkOutAt)}`}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-100">{`${when(p.second.checkInAt)} → ${when(p.second.checkOutAt)}`}</td>
                </tr>
              ))}
            </tbody>
          </Section>

          <Section title={copy.excessive} hint={copy.excessiveHint} count={data.excessiveOvertime.length} none={copy.none}>
            <thead>
              <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                <th className="px-3 py-2 font-semibold">{t.shared.employeeCol}</th>
                <th className="px-3 py-2 font-semibold">{t.myAttendance.colDate}</th>
                <th className="px-3 py-2 font-semibold">{t.workforce.overtime.colWorked}</th>
                <th className="px-3 py-2 font-semibold">{t.workforce.overtime.colOvertime}</th>
              </tr>
            </thead>
            <tbody>
              {data.excessiveOvertime.map((d) => (
                <tr key={`${d.employeeId}|${d.date}`} className="border-b border-ink-800 align-top last:border-0">
                  <td className="px-3 py-2">{person(d.employee)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink-100">{dateFormat.format(new Date(`${d.date}T12:00:00`))}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-ink-100">{d.firstIn && d.lastOut ? `${d.firstIn} → ${d.lastOut}` : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-amber-400">{span(d.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </Section>
        </div>
      ) : null}
    </Panel>
  )
}

function Section({ title, hint, count, none, children }: { title: string; hint: string; count: number; none: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
        {title}
        <Badge tone={count > 0 ? 'warning' : 'neutral'}>{count}</Badge>
      </h3>
      <p className="mt-1 text-xs text-ink-400">{hint}</p>
      {count === 0 ? (
        <p className="mt-2 text-sm text-ink-300">{none}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">{children}</table>
        </div>
      )}
    </section>
  )
}

export default AttendanceDataIssuesPanel
