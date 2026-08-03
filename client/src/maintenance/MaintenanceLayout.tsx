import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'

const TABS = [
  { label: 'Assets', to: '/dashboard/maintenance/assets' },
  { label: 'Contracts', to: '/dashboard/maintenance/contracts' },
  { label: 'Requests', to: '/dashboard/maintenance/requests' },
  { label: 'Schedule', to: '/dashboard/maintenance/schedule' },
]

function MaintenanceLayout() {
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Technet Maintenance"
        subtitle="Asset & Contract Management"
        tabs={TABS}
        searchPlaceholder="Search assets, contracts..."
      />
      <Outlet />
    </div>
  )
}

export default MaintenanceLayout
