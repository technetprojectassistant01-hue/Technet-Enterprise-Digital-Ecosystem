import { Link } from 'react-router-dom'
import { Share2, ArrowRight, KeyRound, FileSignature } from 'lucide-react'
import { Panel } from './dashboard/ui'
import { useT, navLabel } from './i18n'

/** Technet Connect has no dashboard UI of its own - it's the customer-facing portal at /portal/*,
 * a fully separate login from staff. This page just orients staff to where the two staff-side
 * touchpoints actually live, instead of showing an empty stub for a feature that's actually built. */
function ConnectInfoPage() {
  const t = useT()
  const c = t.system.connect
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-100">
          <Share2 className="h-6 w-6" />
          {navLabel(t, 'Technet Connect')}
        </h1>
        <p className="mt-1 text-sm text-ink-300">
          {c.introBefore}
          <code className="text-cyan-accent">/portal</code>
          {c.introAfter}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Panel title={c.grantTitle} icon={KeyRound}>
          <p className="text-sm text-ink-300">{c.grantBody}</p>
          <Link
            to="/dashboard/erp/customers"
            className="mt-4 flex items-center gap-1 text-sm text-cyan-accent hover:underline"
          >
            {c.openCustomers} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Panel>

        <Panel title={c.requestsTitle} icon={FileSignature}>
          <p className="text-sm text-ink-300">{c.requestsBody}</p>
          <Link
            to="/dashboard/erp/customers/quotations"
            className="mt-4 flex items-center gap-1 text-sm text-cyan-accent hover:underline"
          >
            {c.openQuotations} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Panel>
      </div>
    </div>
  )
}

export default ConnectInfoPage
