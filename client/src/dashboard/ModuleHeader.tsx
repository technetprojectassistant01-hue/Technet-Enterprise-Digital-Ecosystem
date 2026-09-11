import { NavLink } from 'react-router-dom'
import { Bell, Search, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './ui'
import { useT } from '../i18n'

interface ModuleTab {
  label: string
  to: string
  end?: boolean
}

/**
 * The module-level bar every ERP/Operations section shares: label + tabs on
 * the left, a decorative local search + notification/settings/avatar on the
 * right. Breaks out of the padded <main> content area with negative margins
 * so it spans full width like the design mockups — the negative margins must
 * track <main>'s responsive padding in Dashboard.tsx exactly.
 *
 * The right-side cluster is hidden below `lg`: it duplicates the dashboard
 * shell header, which already carries notifications/settings/avatar there.
 */
function ModuleHeader({
  title,
  subtitle,
  tabs,
  searchPlaceholder,
}: {
  title: string
  subtitle: string
  tabs: ModuleTab[]
  searchPlaceholder?: string
}) {
  const { user } = useAuth()
  const t = useT()
  const displayName = user?.name || user?.email || ''

  return (
    <div className="-mx-4 -mt-4 mb-6 border-b border-ink-800 bg-ink-900 px-4 py-4 sm:-mx-6 sm:px-6 sm:-mt-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <div className="text-sm text-ink-300">{title}</div>
            <div className="text-sm font-bold uppercase tracking-wide text-ink-100">{subtitle}</div>
          </div>
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }: { isActive: boolean }) =>
                  `shrink-0 border-b-2 px-3 py-1.5 text-sm font-medium transition ${
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

        <div className="hidden items-center gap-4 lg:flex">
          <div className="hidden items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-1.5 sm:flex">
            <Search className="h-3.5 w-3.5 text-ink-400" />
            <input
              type="text"
              placeholder={searchPlaceholder ?? t.shell.moduleSearchPlaceholder}
              className="w-40 bg-transparent text-xs text-ink-100 placeholder-ink-500 outline-none"
            />
          </div>
          <button type="button" className="text-ink-300 hover:text-ink-100" aria-label={t.shell.notifications}>
            <Bell className="h-4 w-4" />
          </button>
          <NavLink to="/dashboard/settings" className="text-ink-300 hover:text-ink-100" aria-label={t.shell.settings}>
            <Settings className="h-4 w-4" />
          </NavLink>
          <Avatar name={displayName} size={28} />
        </div>
      </div>
    </div>
  )
}

export default ModuleHeader
