import { Outlet } from 'react-router-dom'
import { Lock } from 'lucide-react'
import ModuleHeader from '../dashboard/ModuleHeader'
import { EmptyState } from '../dashboard/ui'
import { useAuth } from '../context/AuthContext'
import { hasRole, HR_ROLES } from '../lib/permissions'

const TABS = [{ label: 'Payroll', to: '/dashboard/workforce/payroll' }]

function WorkforceLayout() {
  const { user } = useAuth()
  const canAccess = hasRole(user?.role, HR_ROLES)

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Technet Workforce"
        subtitle="Payroll Preparation"
        tabs={TABS}
        searchPlaceholder="Search payroll runs..."
      />
      {canAccess ? <Outlet /> : <EmptyState icon={Lock} message="This section is restricted to HR staff." />}
    </div>
  )
}

export default WorkforceLayout
