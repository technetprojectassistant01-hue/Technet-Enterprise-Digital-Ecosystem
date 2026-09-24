import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'
import { useAuth } from '../context/AuthContext'
import { hasRole, ATTENDANCE_VIEW_ROLES } from '../lib/permissions'
import { navLabel, useT } from '../i18n'

const TABS = [
  { label: 'Work Orders', to: '/dashboard/operations/work-orders' },
  { label: 'Daily Reports', to: '/dashboard/operations/daily-reports' },
  { label: 'Intervention Reports', to: '/dashboard/operations/intervention-reports' },
  { label: 'Team Attendance', to: '/dashboard/operations/team-attendance' },
  { label: 'Field Operations', to: '/dashboard/operations/field-tracking' },
  { label: 'Attendance Anomalies', to: '/dashboard/operations/anomalies' },
]

function OperationsLayout() {
  const t = useT()
  const { user } = useAuth()
  const tabs = hasRole(user?.role, ATTENDANCE_VIEW_ROLES) ? TABS : TABS.slice(0, 3)
  return (
    <div className="flex flex-col gap-6">
      {/* Just the tabs — no "Technet Operations / Field Service" title (user request). */}
      <ModuleHeader
        tabs={tabs.map((tab) => ({ ...tab, label: navLabel(t, tab.label) }))}
        searchPlaceholder={t.ops.searchPlaceholder}
      />
      <Outlet />
    </div>
  )
}

export default OperationsLayout
