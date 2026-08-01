import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'

const TABS = [
  { label: 'Work Orders', to: '/dashboard/operations/work-orders' },
  { label: 'Daily Reports', to: '/dashboard/operations/daily-reports' },
  { label: 'Intervention Reports', to: '/dashboard/operations/intervention-reports' },
]

function OperationsLayout() {
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Technet Operations"
        subtitle="Field Service"
        tabs={TABS}
        searchPlaceholder="Search work orders..."
      />
      <Outlet />
    </div>
  )
}

export default OperationsLayout
