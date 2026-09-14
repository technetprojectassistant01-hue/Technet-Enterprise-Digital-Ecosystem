import { useEffect, useState } from 'react'
import { CalendarClock, Wrench, FolderKanban, ShoppingCart } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import * as api from './lib/api'
import { StatCard } from './dashboard/ui'
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

  const [stats, setStats] = useState<QuickStats>({
    activeWorkOrders: 0,
    pendingToolRequests: null,
    activeProjects: null,
    pendingRequisitions: null,
  })
  const [statsLoading, setStatsLoading] = useState(true)

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
    </div>
  )
}

export default DashboardHome
