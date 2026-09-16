import { Lock } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { EmptyState } from './dashboard/ui'
import { hasRole, ADMINISTRATIVE_ROLES, OPS_SUBMIT_ROLES } from './lib/permissions'
import AttendanceWidget from './dashboard/AttendanceWidget'
import MyAttendanceHistory from './dashboard/MyAttendanceHistory'
import TodayAttendance from './dashboard/TodayAttendance'
import StaffAttendancePanel from './dashboard/StaffAttendancePanel'
import MyJobsToday from './dashboard/MyJobsToday'
import { useT } from './i18n'

function DashboardHome() {
  const { user } = useAuth()
  const t = useT()
  // Admin and HR administer the website rather than visiting sites, so they don't check in and get
  // no attendance of their own here — they see everybody else's instead (user request 2026-09-16).
  const administers = hasRole(user?.role, ADMINISTRATIVE_ROLES)
  const canCheckIn = !!user?.employeeId && !administers
  // Same audience as the check-in card: staff with an employee record who can check in.
  const canSeeMyAttendance = canCheckIn && hasRole(user?.role, OPS_SUBMIT_ROLES)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-2xl font-bold text-ink-100 sm:text-3xl">
        {user?.name ? t.overview.welcomeBack(user.name) : t.overview.welcome}
      </h1>

      {canCheckIn && <AttendanceWidget />}

      {canCheckIn && <MyJobsToday />}

      {/* A brand-new login has no Employee record until HR links one, and without that link there
          is no check-in card, no Today and no My Attendance — which read as a broken page rather
          than a setup step. Say so instead of showing an empty screen. */}
      {!administers && !user?.employeeId && <EmptyState icon={Lock} message={t.overview.notLinked} />}

      {administers && <StaffAttendancePanel />}

      {canSeeMyAttendance && <TodayAttendance />}

      {canSeeMyAttendance && <MyAttendanceHistory />}
    </div>
  )
}

export default DashboardHome
