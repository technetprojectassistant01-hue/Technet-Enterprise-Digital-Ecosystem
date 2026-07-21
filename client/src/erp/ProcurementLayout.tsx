import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { label: 'Suppliers', to: '/dashboard/erp/procurement/suppliers' },
  { label: 'Requisitions', to: '/dashboard/erp/procurement/requisitions' },
  { label: 'Purchase Orders', to: '/dashboard/erp/procurement/purchase-orders' },
]

function ProcurementLayout() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Procurement</h1>
        <p className="mt-1 text-sm text-ink-300">Suppliers, requisitions, and purchase orders.</p>
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

export default ProcurementLayout
