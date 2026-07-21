import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { label: 'Overview', to: '/dashboard/erp', end: true },
  { label: 'Inventory', to: '/dashboard/erp/inventory' },
  { label: 'Finance', to: '/dashboard/erp/finance' },
  { label: 'Procurement', to: '/dashboard/erp/procurement' },
  { label: 'HR', to: '/dashboard/erp/hr' },
  { label: 'Projects', to: '/dashboard/erp/projects' },
  { label: 'Documents', to: '/dashboard/erp/documents' },
]

function ErpLayout() {
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-1 border-b border-ink-800">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
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

export default ErpLayout
