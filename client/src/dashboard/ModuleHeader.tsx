import { NavLink } from 'react-router-dom'
import { Bell, Search, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './ui'

interface ModuleTab {
  label: string
  to: string
  end?: boolean
}

/**
 * The module-level bar every ERP/Operations section shares: label + tabs on
 * the left, a decorative local search + notification/settings/avatar on the
 * right. Breaks out of the padded <main> content area with negative margins
 * so it spans full width like the design mockups, rather than restructuring
 * the dashboard shell.
 */
function ModuleHeader({
  title,
  subtitle,
  tabs,
  searchPlaceholder = 'Search systems...',
}: {
  title: string
  subtitle: string
  tabs: ModuleTab[]
  searchPlaceholder?: string
}) {
  const { user } = useAuth()
  const displayName = user?.name || user?.email || ''

  return (
    <div className="-mx-8 -mt-6 mb-6 border-b border-ink-800 bg-ink-900 px-8 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <div className="text-sm text-ink-300">{title}</div>
            <div className="text-sm font-bold uppercase tracking-wide text-ink-100">{subtitle}</div>
          </div>
          <nav className="flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }: { isActive: boolean }) =>
                  `border-b-2 px-3 py-1.5 text-sm font-medium transition ${
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
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-1.5 sm:flex">
            <Search className="h-3.5 w-3.5 text-ink-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-40 bg-transparent text-xs text-ink-100 placeholder-ink-500 outline-none"
            />
          </div>
          <button type="button" className="text-ink-300 hover:text-ink-100" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </button>
          <NavLink to="/dashboard/settings" className="text-ink-300 hover:text-ink-100" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </NavLink>
          <Avatar name={displayName} size={28} />
        </div>
      </div>
    </div>
  )
}

export default ModuleHeader
