import { Outlet } from 'react-router-dom'
import ModuleHeader from '../../dashboard/ModuleHeader'

const TABS: { label: string; to: string; end?: boolean }[] = [
  { label: 'Overview', to: '/dashboard/erp/hr', end: true },
  { label: 'Employees', to: '/dashboard/erp/hr/employees' },
  { label: 'Leave', to: '/dashboard/erp/hr/leave' },
  { label: 'Certifications', to: '/dashboard/erp/hr/certifications' },
]

function HrLayout() {
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="HR" subtitle="Management" tabs={TABS} searchPlaceholder="Search resources..." />
      <Outlet />
    </div>
  )
}

export default HrLayout
