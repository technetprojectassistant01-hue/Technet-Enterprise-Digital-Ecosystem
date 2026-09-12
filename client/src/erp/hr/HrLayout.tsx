import { Outlet } from 'react-router-dom'
import ModuleHeader from '../../dashboard/ModuleHeader'
import { navLabel, useT } from '../../i18n'

const TABS: { label: string; to: string; end?: boolean }[] = [
  { label: 'Overview', to: '/dashboard/erp/hr', end: true },
  { label: 'Employees', to: '/dashboard/erp/hr/employees' },
  { label: 'Leave', to: '/dashboard/erp/hr/leave' },
  { label: 'Certifications', to: '/dashboard/erp/hr/certifications' },
]

function HrLayout() {
  const t = useT()
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="HR"
        subtitle={t.hr.subtitle}
        tabs={TABS.map((tab) => ({ ...tab, label: navLabel(t, tab.label) }))}
        searchPlaceholder={t.hr.searchPlaceholder}
      />
      <Outlet />
    </div>
  )
}

export default HrLayout
