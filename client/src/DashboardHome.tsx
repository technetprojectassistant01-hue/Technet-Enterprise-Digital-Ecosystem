import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CalendarClock, Wrench, FolderKanban, ShoppingCart } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import * as api from './lib/api'
import type { Notification } from './lib/api'
import { Panel, StatCard, EmptyState, TableSkeleton } from './dashboard/ui'
import { hasRole, FIELD_ONLY_ROLES, OPS_SUBMIT_ROLES } from './lib/permissions'
import AttendanceWidget from './dashboard/AttendanceWidget'

const ACTIVE_WORK_ORDER_STATUSES = new Set(['SCHEDULED', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'REOPENED'])
const OPEN_MAINTENANCE_REQUEST_STATUSES = new Set(['SUBMITTED', 'SCHEDULED'])

interface QuickStats {
  activeWorkOrders: number
  openMaintenanceRequests: number | null
  activeProjects: number | null
  pendingRequisitions: number | null
}

function DashboardHome() {
  const { user } = useAuth()
  const canOps = hasRole(user?.role, OPS_SUBMIT_ROLES)
  const canNonField = !hasRole(user?.role, FIELD_ONLY_ROLES)

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(true)

  const [stats, setStats] = useState<QuickStats>({
    activeWorkOrders: 0,
    openMaintenanceRequests: null,
    activeProjects: null,
    pendingRequisitions: null,
  })
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    api
      .listNotifications()
      .then(({ notifications }) => setNotifications(notifications.slice(0, 5)))
      .catch(() => {})
      .finally(() => setNotificationsLoading(false))
  }, [])

  useEffect(() => {
    Promise.all([
      api.listWorkOrders(),
      canOps ? api.listMaintenanceRequests() : Promise.resolve(null),
      canNonField ? api.listProjects({ status: 'IN_PROGRESS' }) : Promise.resolve(null),
      canNonField ? api.listRequisitions({ status: 'SUBMITTED' }) : Promise.resolve(null),
    ])
      .then(([woRes, mrRes, projRes, reqRes]) => {
        setStats({
          activeWorkOrders: woRes.workOrders.filter((w) => ACTIVE_WORK_ORDER_STATUSES.has(w.status)).length,
          openMaintenanceRequests: mrRes
            ? mrRes.requests.filter((r) => OPEN_MAINTENANCE_REQUEST_STATUSES.has(r.status)).length
            : null,
          activeProjects: projRes ? projRes.projects.length : null,
          pendingRequisitions: reqRes ? reqRes.requisitions.length : null,
        })
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canOps, canNonField])

  function handleNotificationClick(notification: Notification) {
    if (notification.readAt) return
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
    )
    api.markNotificationRead(notification.id).catch(() => {})
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="text-xs font-semibold tracking-widest text-cyan-accent">OVERVIEW</span>
        <h1 className="mt-1 text-3xl font-bold text-ink-100">Technet Ecosystem</h1>
      </div>

      <Panel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-xs font-semibold tracking-widest text-cyan-accent">
              COMPANY PROFILE
            </span>
            <h2 className="mt-1 text-xl font-semibold text-ink-100">Technet Engineering</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-300">
              A Mauritius-based multi-service engineering firm with over 10 years of history in
              delivering digital kineticism and enterprise solutions across the region.
              {user?.name ? ` Welcome back, ${user.name}.` : ''}
            </p>
          </div>
          <div className="flex gap-8 sm:text-right">
            <div>
              <div className="text-xs font-semibold tracking-widest text-ink-400">ESTABLISHED</div>
              <div className="mt-1 text-lg font-semibold text-cyan-accent">2014</div>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-widest text-ink-400">HQ</div>
              <div className="mt-1 text-lg font-semibold text-cyan-accent">Mauritius</div>
            </div>
          </div>
        </div>
      </Panel>

      {user?.employeeId && <AttendanceWidget />}

      <Panel title="Recent Activity" icon={Bell}>
        {notificationsLoading ? (
          <TableSkeleton rows={3} cols={1} />
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} message="No recent activity." />
        ) : (
          <div className="flex flex-col gap-3">
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
                <Link key={n.id} to={n.link} onClick={() => handleNotificationClick(n)}>
                  {content}
                </Link>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className="text-left"
                >
                  {content}
                </button>
              )
            })}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Work Orders"
          value={statsLoading ? '—' : stats.activeWorkOrders}
          icon={CalendarClock}
        />
        {canOps && (
          <StatCard
            label="Open Maintenance Requests"
            value={statsLoading ? '—' : (stats.openMaintenanceRequests ?? 0)}
            icon={Wrench}
          />
        )}
        {canNonField && (
          <>
            <StatCard
              label="Active Projects"
              value={statsLoading ? '—' : (stats.activeProjects ?? 0)}
              icon={FolderKanban}
            />
            <StatCard
              label="Pending Requisitions"
              value={statsLoading ? '—' : (stats.pendingRequisitions ?? 0)}
              icon={ShoppingCart}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default DashboardHome
