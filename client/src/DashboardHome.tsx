import { Navigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { EmptyState } from './dashboard/ui'
import { hasRole, ADMINISTRATIVE_ROLES, ATTENDANCE_VIEW_ROLES, OPS_SUBMIT_ROLES } from './lib/permissions'
import AttendanceWidget from './dashboard/AttendanceWidget'
import MyAttendanceHistory from './dashboard/MyAttendanceHistory'
import TodayAttendance from './dashboard/TodayAttendance'
import StaffAttendancePanel from './dashboard/StaffAttendancePanel'
import MyJobsToday from './dashboard/MyJobsToday'
import { useT } from './i18n'

function DashboardHome() {
  const { user } = useAuth()
  const t = useT()
  // Admin, HR and the storekeeper have no personal attendance here: the first two run the
  // register rather than appearing in it, the third works entirely in the store.
  const administers = hasRole(user?.role, ADMINISTRATIVE_ROLES)
  const canCheckIn = !!user?.employeeId && !administers
  // Same audience as the check-in card: staff with an employee record who can check in.
  const canSeeMyAttendance = canCheckIn && hasRole(user?.role, OPS_SUBMIT_ROLES)
  // Admin and HR get the whole team's register in place of their own attendance. A storekeeper
  // does not read it, so this page has nothing for them at all — send them to the store instead
  // of showing a title over an empty screen.
  const readsRegister = administers && hasRole(user?.role, ATTENDANCE_VIEW_ROLES)
  if (administers && !readsRegister) return <Navigate to="/dashboard/store/tools" replace />

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

      {readsRegister && <StaffAttendancePanel />}

      {canSeeMyAttendance && <TodayAttendance />}

      {canSeeMyAttendance && <MyAttendanceHistory />}
    </div>
  )
}

export default DashboardHome
