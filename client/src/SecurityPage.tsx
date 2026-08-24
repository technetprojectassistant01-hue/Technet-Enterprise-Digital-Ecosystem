import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, KeyRound, ChevronLeft, ChevronRight } from 'lucide-react'
import * as api from './lib/api'
import type { SecurityEvent, MySecurityEvent, SecurityEventType } from './lib/api'
import { Panel, Badge, EmptyState, TableSkeleton, type BadgeTone } from './dashboard/ui'
import { useAuth } from './context/AuthContext'
import { hasRole } from './lib/permissions'

type View = 'account' | 'audit'

const EVENT_TYPES: SecurityEventType[] = [
  'LOGIN_SUCCEEDED',
  'LOGIN_FAILED',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'ADMIN_PASSWORD_RESET_FORCED',
  'USER_CREATED',
  'USER_ROLE_CHANGED',
  'USER_DELETED',
]

const EVENT_TONE: Record<SecurityEventType, BadgeTone> = {
  LOGIN_SUCCEEDED: 'success',
  LOGIN_FAILED: 'danger',
  PASSWORD_CHANGED: 'accent',
  PASSWORD_RESET_REQUESTED: 'accent',
  PASSWORD_RESET_COMPLETED: 'accent',
  ADMIN_PASSWORD_RESET_FORCED: 'warning',
  USER_CREATED: 'success',
  USER_ROLE_CHANGED: 'warning',
  USER_DELETED: 'danger',
}

const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'

function EventBadge({ type }: { type: SecurityEventType }) {
  return <Badge tone={EVENT_TONE[type]}>{type.replace(/_/g, ' ')}</Badge>
}

function MyAccountTab() {
  const [events, setEvents] = useState<MySecurityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .listMySecurityEvents()
      .then(({ events }) => setEvents(events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Panel title="Recent Logins" icon={KeyRound}>
      <p className="mb-4 text-sm text-ink-400">
        Your own recent login attempts, successful and failed. If you see a failed attempt you don't
        recognize, change your password from Settings.
      </p>
      {loading ? (
        <TableSkeleton rows={4} cols={2} />
      ) : events.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">No login history yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
              <EventBadge type={e.type} />
              <span className="text-ink-400">{new Date(e.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function AuditLogTab() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<SecurityEventType | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 25

  const load = useCallback(() => {
    setLoading(true)
    api
      .listSecurityEvents({
        type: type || undefined,
        from: from || undefined,
        to: to || undefined,
        take: pageSize,
        skip: page * pageSize,
      })
      .then(({ events, total }) => {
        setEvents(events)
        setTotal(total)
      })
      .catch(() => {
        setEvents([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [type, from, to, page])

  useEffect(load, [load])

  function updateFilter(patch: { type?: SecurityEventType | ''; from?: string; to?: string }) {
    if (patch.type !== undefined) setType(patch.type)
    if (patch.from !== undefined) setFrom(patch.from)
    if (patch.to !== undefined) setTo(patch.to)
    setPage(0)
  }

  return (
    <Panel title="Audit Log" icon={ShieldCheck}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold tracking-widest text-ink-400">EVENT TYPE</label>
          <select
            value={type}
            onChange={(e) => updateFilter({ type: e.target.value as SecurityEventType | '' })}
            className={inputClass}
          >
            <option value="">All types</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold tracking-widest text-ink-400">FROM</label>
          <input type="date" value={from} onChange={(e) => updateFilter({ from: e.target.value })} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold tracking-widest text-ink-400">TO</label>
          <input type="date" value={to} onChange={(e) => updateFilter({ to: e.target.value })} className={inputClass} />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : events.length === 0 ? (
        <EmptyState icon={ShieldCheck} message="No events match these filters." />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-400">{total} event{total === 1 ? '' : 's'} found</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">TIME</th>
                  <th className="px-3 py-3 font-semibold">EVENT</th>
                  <th className="px-3 py-3 font-semibold">ACTOR</th>
                  <th className="px-3 py-3 font-semibold">TARGET</th>
                  <th className="px-3 py-3 font-semibold">DETAIL</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-400">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <EventBadge type={e.type} />
                    </td>
                    <td className="px-3 py-3 text-ink-300">{e.actorEmail}</td>
                    <td className="px-3 py-3 text-ink-300">{e.target?.email ?? '—'}</td>
                    <td className="px-3 py-3 text-ink-400">{e.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-ink-400">
              Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * pageSize >= total}
              className="rounded-md border border-ink-600 p-2 text-ink-300 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </Panel>
  )
}

function SecurityPage() {
  const { user } = useAuth()
  const isAdmin = hasRole(user?.role, ['ADMIN'])
  const [view, setView] = useState<View>('account')

  const views: { key: View; label: string }[] = isAdmin
    ? [
        { key: 'account', label: 'My Account' },
        { key: 'audit', label: 'Audit Log' },
      ]
    : [{ key: 'account', label: 'My Account' }]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Security</h1>
        <p className="mt-1 text-sm text-ink-300">
          {isAdmin
            ? 'Your own login history, plus a company-wide log of security-relevant events.'
            : 'Your own recent login history.'}
        </p>
      </div>

      {views.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                view === v.key
                  ? 'bg-cyan-accent/10 text-cyan-accent'
                  : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {view === 'account' || !isAdmin ? <MyAccountTab /> : <AuditLogTab />}
    </div>
  )
}

export default SecurityPage
