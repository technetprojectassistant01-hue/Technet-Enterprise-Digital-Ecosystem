import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'
import { navLabel, useT } from '../i18n'

const TABS = [
  { label: 'Work Orders', to: '/dashboard/operations/work-orders' },
  { label: 'Daily Reports', to: '/dashboard/operations/daily-reports' },
  { label: 'Intervention Reports', to: '/dashboard/operations/intervention-reports' },
]

function OperationsLayout() {
  const t = useT()
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Technet Operations"
        subtitle={t.ops.subtitle}
        tabs={TABS.map((tab) => ({ ...tab, label: navLabel(t, tab.label) }))}
        searchPlaceholder={t.ops.searchPlaceholder}
      />
      <Outlet />
    </div>
  )
}

export default OperationsLayout
