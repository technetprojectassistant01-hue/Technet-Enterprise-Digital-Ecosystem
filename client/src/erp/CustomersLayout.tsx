import { Outlet } from 'react-router-dom'
import ModuleHeader from '../dashboard/ModuleHeader'
import { navLabel, useT } from '../i18n'

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
  const t = useT()
  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title={navLabel(t, 'Customers')}
        subtitle={t.erp.shared.management}
        tabs={TABS.map((tab) => ({ ...tab, label: navLabel(t, tab.label) }))}
        searchPlaceholder={t.erp.customersLayout.searchPlaceholder}
      />
      <Outlet />
    </div>
  )
}

export default CustomersLayout
