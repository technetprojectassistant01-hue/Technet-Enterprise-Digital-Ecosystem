import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'

/**
 * Used to be Finance. Invoices and expenses were removed on 2026-09-17 because the company keeps
 * them in QuickBooks, which left the customer side: who the customers are, what was quoted to
 * them, the follow-up calls, and the contracts they signed.
 */
const TABS = [
  { label: 'Customers', to: '/dashboard/erp/customers', end: true },
  { label: 'Quotations', to: '/dashboard/erp/customers/quotations' },
  { label: 'Follow-Up', to: '/dashboard/erp/customers/follow-up' },
  { label: 'Contracts', to: '/dashboard/erp/customers/contracts' },
]

function CustomersLayout() {
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Customers" subtitle="Management" tabs={TABS} searchPlaceholder="Search systems..." />
      <Outlet />
    </div>
  )
}

export default CustomersLayout
