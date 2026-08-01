import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'

const TABS = [
  { label: 'Customers', to: '/dashboard/erp/finance/customers' },
  { label: 'Invoices', to: '/dashboard/erp/finance/invoices' },
  { label: 'Expenses', to: '/dashboard/erp/finance/expenses' },
  { label: 'Quotations', to: '/dashboard/erp/finance/quotations' },
  { label: 'Contracts', to: '/dashboard/erp/finance/contracts' },
]

function FinanceLayout() {
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Finance" subtitle="Management" tabs={TABS} searchPlaceholder="Search systems..." />
      <Outlet />
    </div>
  )
}

export default FinanceLayout
