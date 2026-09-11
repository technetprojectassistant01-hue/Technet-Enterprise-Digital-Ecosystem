import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, Search, Settings, X } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import Logo from './components/Logo'
import { Avatar } from './dashboard/ui'
import SidebarContent from './dashboard/SidebarContent'
import MobileNav from './dashboard/MobileNav'
import NotificationBell from './dashboard/NotificationBell'
import SyncStatus from './dashboard/SyncStatus'
import { useToast } from './dashboard/ToastContext'
import { InstallAppPrompt } from './dashboard/InstallAppDialog'
import { setOutboxDropHandler, startOutbox } from './lib/outbox'
import { useOnline } from './lib/useOnline'
import { watchForAppUpdate } from './lib/appUpdate'

function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const { pathname } = useLocation()
  const online = useOnline()
  const [navOpen, setNavOpen] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  // Start the offline outbox (the service worker itself is registered in main.tsx): it replays
  // field submissions that were saved on the device during a signal drop. A submission the
  // server permanently rejects on replay is surfaced here rather than lost silently.
  useEffect(() => {
    startOutbox()
    setOutboxDropHandler((item) =>
      toastRef.current.error(
        `"${item.label}" couldn't be submitted${item.lastError ? `: ${item.lastError}` : ''}`,
      ),
    )
    return () => setOutboxDropHandler(() => {})
  }, [])

  // A new deploy's service worker takes over silently; without this someone can be stuck on a
  // stale bundle until they fully close and reopen the app (CLAUDE.md — post-launch brief item 6).
  useEffect(() => watchForAppUpdate(() => setUpdateAvailable(true)), [])

  // Close the mobile nav on navigation, and on Escape; lock body scroll while it's open.
  useEffect(() => setNavOpen(false), [pathname])
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [navOpen])

  const displayName = user?.name || user?.email || ''

  return (
    <div className="flex min-h-screen bg-ink-950 text-ink-100">
      {/* Desktop sidebar — always visible from lg up */}
      <aside className="hidden w-64 shrink-0 border-r border-ink-800 lg:flex">
        <SidebarContent />
      </aside>

      {/* Tablet / phone drawer */}
      {navOpen && (
        <>
          <div
            className="animate-backdrop-in fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-72 border-r border-ink-800 bg-ink-950 shadow-2xl lg:hidden"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 rounded p-1 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
              style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-ink-800 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8 lg:py-4">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="rounded p-1 text-ink-300 hover:bg-ink-800 hover:text-ink-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="lg:hidden">
            <Logo size="sm" />
          </div>

          <div className="hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 sm:flex">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search orders, clients, invoices..."
              className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
            />
          </div>

          <div className="ml-auto flex items-center gap-3 sm:gap-5">
            <SyncStatus />
            <NotificationBell />
            <NavLink to="/dashboard/settings" className="text-ink-300 hover:text-ink-100" aria-label="Settings">
              <Settings className="h-5 w-5" />
            </NavLink>
            <div className="flex items-center gap-3">
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-sm font-medium text-ink-100">{displayName}</div>
                <div className="text-xs text-ink-400">{user?.role}</div>
              </div>
              <Avatar name={displayName} />
            </div>
          </div>
        </header>

        <MobileNav onOpenAll={() => setNavOpen(true)} />

        {!online && (
          <div className="border-b border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs text-amber-300 sm:px-6 lg:px-8">
            Offline — showing your last synced data. Anything you save is kept on this device and
            uploads automatically when you reconnect.
          </div>
        )}

        {updateAvailable && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-accent/30 bg-cyan-accent/10 px-4 py-2 text-xs text-cyan-accent sm:px-6 lg:px-8">
            <span>A new version of Technet Digital is available.</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-cyan-accent/40 px-2.5 py-1 font-semibold hover:bg-cyan-accent/10"
            >
              Reload
            </button>
          </div>
        )}

        <InstallAppPrompt appName="Technet Digital" />

        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div key={pathname} className="animate-fade-in">
            <Outlet />
          </div>
        </main>

        <footer className="flex flex-col gap-3 border-t border-ink-800 px-4 py-4 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>© 2026 Technet Engineering.</span>
          <div className="flex flex-wrap gap-5">
            <a href="#" className="hover:text-ink-200">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-ink-200">
              Terms of Service
            </a>
            <a href="#" className="hover:text-ink-200">
              Contact Support
            </a>
            <a href="#" className="hover:text-ink-200">
              Security Audit
            </a>
          </div>
          <span className="flex items-center gap-2 text-ink-300">
            SYSTEM STABLE:
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-accent" />
          </span>
        </footer>
      </div>
    </div>
  )
}

export default Dashboard
