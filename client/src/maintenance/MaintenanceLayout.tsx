import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'
import { navLabel, useT } from '../i18n'

const TABS = [
  { label: 'Assets', to: '/dashboard/maintenance/assets' },
  { label: 'Contracts', to: '/dashboard/maintenance/contracts' },
  { label: 'Requests', to: '/dashboard/maintenance/requests' },
  { label: 'Schedule', to: '/dashboard/maintenance/schedule' },
]

function MaintenanceLayout() {
  const t = useT()
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Technet Maintenance"
        subtitle={t.maint.subtitle}
        tabs={TABS.map((tab) => ({ ...tab, label: navLabel(t, tab.label) }))}
        searchPlaceholder={t.maint.searchPlaceholder}
      />
      <Outlet />
    </div>
  )
}

export default MaintenanceLayout
