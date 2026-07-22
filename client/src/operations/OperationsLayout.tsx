import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { label: 'Work Orders', to: '/dashboard/operations/work-orders' },
  { label: 'Daily Reports', to: '/dashboard/operations/daily-reports' },
  { label: 'Intervention Reports', to: '/dashboard/operations/intervention-reports' },
]

function OperationsLayout() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Technet Operations</h1>
        <p className="mt-1 text-sm text-ink-300">Work orders, technician scheduling, and field reports.</p>
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

export default OperationsLayout
