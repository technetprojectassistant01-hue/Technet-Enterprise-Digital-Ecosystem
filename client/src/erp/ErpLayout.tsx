import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { hasRole, NON_COMMERCIAL_ROLES } from '../lib/permissions'
import type { Role } from '../lib/api'

/**
 * A storekeeper reaches ERP for Inventory and Procurement only — the selling half is not their
 * job (user request 2026-09-16). Tabs they cannot use are left out rather than shown as dead
 * links, the same rule Technet HR follows.
 */
const TABS: { label: string; to: string; end?: boolean; commercial?: boolean }[] = [
  { label: 'Overview', to: '/dashboard/erp', end: true, commercial: true },
  { label: 'Inventory', to: '/dashboard/erp/inventory' },
  { label: 'Customers', to: '/dashboard/erp/customers', commercial: true },
  { label: 'Procurement', to: '/dashboard/erp/procurement' },
  { label: 'Projects', to: '/dashboard/erp/projects', commercial: true },
  { label: 'Documents', to: '/dashboard/erp/documents', commercial: true },
]

function visibleTabs(role: Role | undefined) {
  return TABS.filter((tab) => !tab.commercial || !hasRole(role, NON_COMMERCIAL_ROLES))
}

function ErpLayout() {
  const { user } = useAuth()
  const tabs = visibleTabs(user?.role)

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-1 border-b border-ink-800">
        {tabs.map((tab) => (
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
