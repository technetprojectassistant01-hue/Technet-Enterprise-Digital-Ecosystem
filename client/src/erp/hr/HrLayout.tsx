import { NavLink, Outlet } from 'react-router-dom'

const TABS: { label: string; to: string; end?: boolean }[] = [
  { label: 'Overview', to: '/dashboard/erp/hr', end: true },
  { label: 'Employees', to: '/dashboard/erp/hr/employees' },
  { label: 'Leave', to: '/dashboard/erp/hr/leave' },
  { label: 'Attendance', to: '/dashboard/erp/hr/attendance' },
  { label: 'Certifications', to: '/dashboard/erp/hr/certifications' },
]

function HrLayout() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Human Resources</h1>
        <p className="mt-1 text-sm text-ink-300">
          Employee records, leave, attendance, and certification tracking.
        </p>
      </div>

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

export default HrLayout
