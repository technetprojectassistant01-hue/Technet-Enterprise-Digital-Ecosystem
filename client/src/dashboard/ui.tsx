import { useEffect, useState, type ReactNode } from 'react'
import { X, type LucideIcon } from 'lucide-react'

/**
 * The shared, hand-built UI kit. Every module reuses these primitives, so a refinement here
 * cascades to the whole app. The 2026-09-10 pass aimed for "cleaner and more confidence-inspiring,
 * not busier": softer borders + a subtle shadow so surfaces read as layered rather than flat and
 * outlined, keyboard focus rings, gentle press states, and pill badges.
 */

export function Panel({
  title,
  icon: Icon,
  badge,
  action,
  className = '',
  children,
}: {
  title?: string
  icon?: LucideIcon
  badge?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={`animate-fade-in-up rounded-xl border border-ink-800 bg-ink-900 p-5 shadow-sm shadow-black/20 sm:p-6 ${className}`}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink-100">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-ink-300" />}
            <span className="truncate">{title}</span>
            {badge}
          </h2>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaTone = 'positive',
  sub,
  progress,
}: {
  label: string
  value: ReactNode
  icon?: LucideIcon
  delta?: string
  deltaTone?: 'positive' | 'warning'
  sub?: string
  /** 0-100. Renders a thin progress bar under the value, matching the design mockups. */
  progress?: number
}) {
  return (
    <div className="animate-fade-in-up rounded-xl border border-ink-800 bg-ink-900 p-5 shadow-sm shadow-black/20 transition duration-150 hover:-translate-y-0.5 hover:border-ink-700 hover:shadow-md hover:shadow-black/30">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold tracking-widest text-ink-400">{label}</span>
        {Icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-accent/10 text-cyan-accent">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-2xl font-semibold text-ink-100">{value}</span>
        {delta && (
          <span
            className={`shrink-0 text-xs font-medium ${
              deltaTone === 'positive' ? 'text-cyan-accent' : 'text-amber-400'
            }`}
          >
            {delta}
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-400">{sub}</div>}
      {progress !== undefined && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-cyan-accent transition-[width] duration-500"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function BarChart({
  data,
  highlight,
  height = 220,
}: {
  data: { label: string; value: number }[]
  highlight?: (label: string, index: number) => boolean
  height?: number
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const [grown, setGrown] = useState(false)

  useEffect(() => {
    setGrown(false)
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [data])

  return (
    <div>
      <div className="flex items-end gap-3" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t-sm transition-[height] duration-500 ease-out ${
              highlight?.(d.label, i) ? 'bg-cyan-accent' : 'bg-ink-600'
            }`}
            style={{
              height: grown ? `${(d.value / max) * 100}%` : '0%',
              transitionDelay: `${i * 30}ms`,
            }}
            title={`${d.label}: ${d.value}`}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-3">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[10px] text-ink-400">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Modal({
  title,
  onClose,
  size = 'md',
  children,
}: {
  title: string
  onClose: () => void
  size?: 'md' | 'lg'
  children: ReactNode
}) {
  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`animate-scale-in flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-ink-700 bg-ink-900 p-4 shadow-2xl shadow-black/50 sm:max-h-[85vh] sm:rounded-xl sm:p-6 ${
          size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="truncate text-base font-semibold text-ink-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-md p-1 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="-mr-2 overflow-y-auto pr-2">{children}</div>
      </div>
    </div>
  )
}

export type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'success'

const badgeToneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-ink-700 text-ink-300',
  accent: 'bg-cyan-accent/10 text-cyan-accent',
  warning: 'bg-amber-400/10 text-amber-400',
  danger: 'bg-red-400/10 text-red-400',
  success: 'bg-emerald-400/10 text-emerald-400',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-white/5 ${badgeToneClasses[tone]}`}
    >
      {children}
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: LucideIcon
  message: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 text-ink-500 ring-1 ring-inset ring-white/5">
        <Icon className="h-6 w-6" />
      </span>
      <p className="max-w-sm text-sm text-ink-400">{message}</p>
      {action}
    </div>
  )
}

export function TableSkeleton({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <span
              key={c}
              className="h-4 flex-1 rounded bg-[linear-gradient(90deg,var(--color-ink-800)_25%,var(--color-ink-700)_50%,var(--color-ink-800)_75%)] bg-[length:200%_100%] animate-shimmer"
              style={{ animationDelay: `${(r * cols + c) * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-cyan-accent/20 font-semibold text-cyan-accent ring-1 ring-inset ring-cyan-accent/20"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || '?'}
    </div>
  )
}
