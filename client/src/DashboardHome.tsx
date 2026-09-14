import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CalendarClock, Wrench, FolderKanban, ShoppingCart } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import * as api from './lib/api'
import type { Notification } from './lib/api'
import { Panel, StatCard, EmptyState, TableSkeleton } from './dashboard/ui'
import { hasRole, FIELD_ONLY_ROLES, OPS_SUBMIT_ROLES, TOOL_MANAGE_ROLES } from './lib/permissions'
import AttendanceWidget from './dashboard/AttendanceWidget'
import MyAttendanceHistory from './dashboard/MyAttendanceHistory'
import TodayAttendance from './dashboard/TodayAttendance'
import { useT } from './i18n'

const ACTIVE_WORK_ORDER_STATUSES = new Set(['SCHEDULED', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'REOPENED'])

interface QuickStats {
  activeWorkOrders: number
  pendingToolRequests: number | null
  activeProjects: number | null
  pendingRequisitions: number | null
}

function DashboardHome() {
  const { user } = useAuth()
  const t = useT()
  // Store staff see every pending request; anyone else with an employee record sees their own.
  const canSeeToolRequests = !!user?.employeeId || hasRole(user?.role, TOOL_MANAGE_ROLES)
  const canNonField = !hasRole(user?.role, FIELD_ONLY_ROLES)
  // Same audience as the check-in card: staff with an employee record who can check in.
  const canSeeMyAttendance = !!user?.employeeId && hasRole(user?.role, OPS_SUBMIT_ROLES)

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(true)

  const [stats, setStats] = useState<QuickStats>({
    activeWorkOrders: 0,
    pendingToolRequests: null,
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
      canSeeToolRequests ? api.listToolRequests({ status: 'PENDING' }) : Promise.resolve(null),
      canNonField ? api.listProjects({ status: 'IN_PROGRESS' }) : Promise.resolve(null),
      canNonField ? api.listRequisitions({ status: 'SUBMITTED' }) : Promise.resolve(null),
    ])
      .then(([woRes, toolRes, projRes, reqRes]) => {
        setStats({
          activeWorkOrders: woRes.workOrders.filter((w) => ACTIVE_WORK_ORDER_STATUSES.has(w.status)).length,
          pendingToolRequests: toolRes ? toolRes.requests.length : null,
          activeProjects: projRes ? projRes.projects.length : null,
          pendingRequisitions: reqRes ? reqRes.requisitions.length : null,
        })
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeToolRequests, canNonField])

  function handleNotificationClick(notification: Notification) {
    if (notification.readAt) return
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
    )
    api.markNotificationRead(notification.id).catch(() => {})
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink-100 sm:text-3xl">
        {user?.name ? t.overview.welcomeBack(user.name) : t.overview.welcome}
      </h1>

      {user?.employeeId && <AttendanceWidget />}

      {canSeeMyAttendance && <TodayAttendance />}


      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t.overview.activeWorkOrders}
          value={statsLoading ? '—' : stats.activeWorkOrders}
          icon={CalendarClock}
        />
        {canSeeToolRequests && (
          <StatCard
            label={t.overview.pendingToolRequests}
            value={statsLoading ? '—' : (stats.pendingToolRequests ?? 0)}
            icon={Wrench}
          />
        )}
        {canNonField && (
          <>
            <StatCard
              label={t.overview.activeProjects}
              value={statsLoading ? '—' : (stats.activeProjects ?? 0)}
              icon={FolderKanban}
            />
            <StatCard
              label={t.overview.pendingRequisitions}
              value={statsLoading ? '—' : (stats.pendingRequisitions ?? 0)}
              icon={ShoppingCart}
            />
          </>
        )}
      </div>

      {canSeeMyAttendance && <MyAttendanceHistory />}

      <Panel title={t.overview.recentActivity} icon={Bell}>
        {notificationsLoading ? (
          <TableSkeleton rows={3} cols={1} />
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} message={t.overview.noRecentActivity} />
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
                    <span className="shrink-0 text-[11px] text-ink-400">
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
    </div>
  )
}

export default DashboardHome
