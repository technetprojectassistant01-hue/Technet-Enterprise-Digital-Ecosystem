import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'
import { navLabel, useT } from '../i18n'

const TABS = [
  { label: 'Suppliers', to: '/dashboard/erp/procurement/suppliers' },
  { label: 'Requisitions', to: '/dashboard/erp/procurement/requisitions' },
  { label: 'Purchase Orders', to: '/dashboard/erp/procurement/purchase-orders' },
]

function ProcurementLayout() {
  const t = useT()
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title={t.erp.procurement.title}
        subtitle={t.erp.shared.management}
        tabs={TABS.map((tab) => ({ ...tab, label: navLabel(t, tab.label) }))}
        searchPlaceholder={t.erp.procurement.searchPlaceholder}
      />
      <Outlet />
    </div>
  )
}

export default ProcurementLayout
