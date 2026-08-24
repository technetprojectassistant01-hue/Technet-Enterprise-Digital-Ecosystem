import { Link } from 'react-router-dom'
import { Share2, ArrowRight, KeyRound, FileSignature } from 'lucide-react'
import { Panel } from './dashboard/ui'

/** Technet Connect has no dashboard UI of its own - it's the customer-facing portal at /portal/*,
 * a fully separate login from staff. This page just orients staff to where the two staff-side
 * touchpoints actually live, instead of showing an empty stub for a feature that's actually built. */
function ConnectInfoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-100">
          <Share2 className="h-6 w-6" />
          Technet Connect
        </h1>
        <p className="mt-1 text-sm text-ink-300">
          The customer self-service portal lives at its own address, separate from this dashboard
          and from staff logins entirely — customers sign in at <code className="text-cyan-accent">/portal</code>,
          not here. What you do from this dashboard is manage access and respond to requests:
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Panel title="Grant a customer access" icon={KeyRound}>
          <p className="text-sm text-ink-300">
            From the Customers page, grant a customer their own portal login so they can view their
            quotations, invoices, and job status, or reset/revoke it later.
          </p>
          <Link
            to="/dashboard/erp/finance/customers"
            className="mt-4 flex items-center gap-1 text-sm text-cyan-accent hover:underline"
          >
            Open Customers <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Panel>

        <Panel title="Respond to quote requests" icon={FileSignature}>
          <p className="text-sm text-ink-300">
            When a customer requests a quote through the portal, it shows up on the Quotations page
            under Quote Requests — convert it into a real quotation or decline it there.
          </p>
          <Link
            to="/dashboard/erp/finance/quotations"
            className="mt-4 flex items-center gap-1 text-sm text-cyan-accent hover:underline"
          >
            Open Quotations <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Panel>
      </div>
    </div>
  )
}

export default ConnectInfoPage
