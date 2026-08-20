import { Outlet } from 'react-router-dom'
import { Lock } from 'lucide-react'
import ModuleHeader from '../dashboard/ModuleHeader'
import { EmptyState } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, WORKFORCE_VIEW_ROLES } from '../lib/permissions'

const TABS = [
  { label: 'Availability', to: '/dashboard/workforce/availability' },
  { label: 'Attendance', to: '/dashboard/workforce/attendance' },
  { label: 'Payroll', to: '/dashboard/workforce/payroll' },
]

function WorkforceLayout() {
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, WORKFORCE_VIEW_ROLES)

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Technet Workforce"
        subtitle="Who's available, attendance, and payroll preparation"
        tabs={TABS}
        searchPlaceholder="Search payroll runs..."
      />
      {canAccess ? (
        <Outlet />
      ) : (
        <EmptyState icon={Lock} message="This section is restricted to HR staff and Operations management." />
      )}
    </div>
  )
}

export default WorkforceLayout
