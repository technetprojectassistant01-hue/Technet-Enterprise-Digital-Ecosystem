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
  // Sales and Finance do not check in either (the server's check-in routes are OPS_SUBMIT_ROLES
  // only - showing them the card only led to a refused check-in; user decision 2026-10-19).
  const checksIn = !administers && hasRole(user?.role, OPS_SUBMIT_ROLES)
  const canCheckIn = !!user?.employeeId && checksIn
  // Admin and HR get the whole team's register in place of their own attendance. Everyone else
  // who neither checks in nor reads it has nothing on this page, so send them to their own work
  // instead of showing a title over an empty screen: the storekeeper to the store, Sales and
  // Finance to Technet ERP.
  const readsRegister = administers && hasRole(user?.role, ATTENDANCE_VIEW_ROLES)
  if (!checksIn && !readsRegister) {
    return <Navigate to={administers ? '/dashboard/store/tools' : '/dashboard/erp'} replace />
  }

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

      {canCheckIn && <TodayAttendance />}

      {canCheckIn && <MyAttendanceHistory />}
    </div>
  )
}

export default DashboardHome
