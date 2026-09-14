import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * A page's title block: an icon tile beside the title and a one-line description. Used at the
 * top of the technician-facing list pages so they share one look.
 */
function PageTitle({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-accent/20 bg-gradient-to-br from-cyan-accent/20 to-cyan-accent/5 text-cyan-accent shadow-lg shadow-cyan-accent/5">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink-100">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-300">{subtitle}</p>}
      </div>
    </div>
  )
}

export default PageTitle
