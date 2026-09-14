import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar } from './ui'
import { useT } from '../i18n'

/**
 * The name + avatar in the top bar. Tapping it opens a small menu with Settings and Log out, so
 * signing out doesn't mean scrolling to the bottom of the sidebar (that Log out stays too).
 */
function UserMenu() {
  const { user, logout } = useAuth()
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const displayName = user?.name || user?.email || ''

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-lg p-1 transition hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-accent sm:pl-3"
      >
        <div className="hidden text-right leading-tight sm:block">
          <div className="text-sm font-medium text-ink-100">{displayName}</div>
          <div className="text-xs text-ink-400">{user ? t.roles[user.role] : ''}</div>
        </div>
        <Avatar name={displayName} />
        <ChevronDown
          className={`hidden h-4 w-4 text-ink-400 transition-transform sm:block ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-scale-in absolute right-0 z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl shadow-black/50"
        >
          <div className="border-b border-ink-800 px-4 py-3">
            <div className="truncate text-sm font-medium text-ink-100">{displayName}</div>
            {user?.name && <div className="truncate text-xs text-ink-400">{user.email}</div>}
            <div className="mt-0.5 text-xs text-ink-400">{user ? t.roles[user.role] : ''}</div>
          </div>
          <div className="p-1">
            <NavLink
              to="/dashboard/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink-200 hover:bg-ink-800 hover:text-ink-100"
            >
              <Settings className="h-4 w-4" />
              {t.shell.settings}
            </NavLink>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                logout()
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-red-300 hover:bg-red-400/10 hover:text-red-200"
            >
              <LogOut className="h-4 w-4" />
              {t.shell.logOut}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserMenu
