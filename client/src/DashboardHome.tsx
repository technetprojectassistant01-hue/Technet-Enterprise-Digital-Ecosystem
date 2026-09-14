import { useEffect, useState } from 'react'
import { FolderKanban, ShoppingCart } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import * as api from './lib/api'
import { StatCard } from './dashboard/ui'
import { hasRole, FIELD_ONLY_ROLES, OPS_SUBMIT_ROLES } from './lib/permissions'
import AttendanceWidget from './dashboard/AttendanceWidget'
import MyAttendanceHistory from './dashboard/MyAttendanceHistory'
import TodayAttendance from './dashboard/TodayAttendance'
import { useT } from './i18n'

interface QuickStats {
  activeProjects: number | null
  pendingRequisitions: number | null
}

function DashboardHome() {
  const { user } = useAuth()
  const t = useT()
  const canNonField = !hasRole(user?.role, FIELD_ONLY_ROLES)
  // Same audience as the check-in card: staff with an employee record who can check in.
  const canSeeMyAttendance = !!user?.employeeId && hasRole(user?.role, OPS_SUBMIT_ROLES)

  const [stats, setStats] = useState<QuickStats>({
    activeProjects: null,
    pendingRequisitions: null,
  })
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    // Field staff see no stat cards, so they don't fetch anything here.
    if (!canNonField) {
      setStatsLoading(false)
      return
    }
    Promise.all([api.listProjects({ status: 'IN_PROGRESS' }), api.listRequisitions({ status: 'SUBMITTED' })])
      .then(([projRes, reqRes]) => {
        setStats({
          activeProjects: projRes.projects.length,
          pendingRequisitions: reqRes.requisitions.length,
        })
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canNonField])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-2xl font-bold text-ink-100 sm:text-3xl">
        {user?.name ? t.overview.welcomeBack(user.name) : t.overview.welcome}
      </h1>

      {user?.employeeId && <AttendanceWidget />}

      {canSeeMyAttendance && <TodayAttendance />}

      {canNonField && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
        </div>
      )}

      {canSeeMyAttendance && <MyAttendanceHistory />}
    </div>
  )
}

export default DashboardHome
