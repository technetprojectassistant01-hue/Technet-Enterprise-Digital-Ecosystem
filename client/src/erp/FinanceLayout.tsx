import { NavLink, Outlet } from 'react-router-dom'

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
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Finance</h1>
        <p className="mt-1 text-sm text-ink-300">Customers, invoices, expenses, and the sales pipeline.</p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-ink-800">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }: { isActive: boolean }) =>
              `border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'border-cyan-accent text-cyan-accent'
                  : 'border-transparent text-ink-300 hover:text-ink-100'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}

export default FinanceLayout
