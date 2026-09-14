import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'
import { navLabel, useT } from '../i18n'

const TABS = [
  { label: 'Tools & Equipment', to: '/dashboard/store/tools' },
  { label: 'Tool Requests', to: '/dashboard/store/requests' },
]

function StoreLayout() {
  const t = useT()
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Technet Store"
        subtitle={t.tools.moduleSubtitle}
        tabs={TABS.map((tab) => ({ ...tab, label: navLabel(t, tab.label) }))}
        searchPlaceholder={t.tools.moduleSearchPlaceholder}
      />
      <Outlet />
    </div>
  )
}

export default StoreLayout
