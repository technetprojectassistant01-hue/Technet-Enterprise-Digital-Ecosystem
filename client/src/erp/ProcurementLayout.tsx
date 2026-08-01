import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'

const TABS = [
  { label: 'Suppliers', to: '/dashboard/erp/procurement/suppliers' },
  { label: 'Requisitions', to: '/dashboard/erp/procurement/requisitions' },
  { label: 'Purchase Orders', to: '/dashboard/erp/procurement/purchase-orders' },
]

function ProcurementLayout() {
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Procurement"
        subtitle="Management"
        tabs={TABS}
        searchPlaceholder="Search suppliers, POs, or parts..."
      />
      <Outlet />
    </div>
  )
}

export default ProcurementLayout
