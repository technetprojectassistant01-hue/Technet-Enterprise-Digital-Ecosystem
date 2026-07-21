import type { LucideIcon } from 'lucide-react'

function ModuleStub({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-ink-700 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 text-cyan-accent">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <h1 className="text-xl font-semibold text-ink-100">{title}</h1>
        <p className="mt-1 text-sm text-ink-400">This module's design is coming soon.</p>
      </div>
    </div>
  )
}

export default ModuleStub
