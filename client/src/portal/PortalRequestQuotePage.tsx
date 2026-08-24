import { useEffect, useState, type FormEvent } from 'react'
import { FileSignature } from 'lucide-react'
import * as api from '../lib/api'
import type { QuotationRequest } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'

const STATUS_TONE = {
  PENDING: 'warning',
  CONVERTED: 'success',
  DECLINED: 'danger',
} as const

function PortalRequestQuotePage() {
  const toast = useToast()
  const [requests, setRequests] = useState<QuotationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    api
      .portalListQuoteRequests()
      .then(({ requests }) => setRequests(requests))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!description.trim()) return setFormError('Please describe what you need a quote for')

    setSubmitting(true)
    try {
      await api.portalSubmitQuoteRequest(description)
      toast.success('Request sent - we will follow up with a formal quotation')
      setDescription('')
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Request a Quote</h1>
        <p className="mt-1 text-sm text-ink-300">
          Tell us what you need and we'll follow up with a formal quotation.
        </p>
      </div>

      <Panel>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. We need 3 new air conditioning units installed at our office in Ebene..."
            rows={4}
            className="w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent"
          />
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Sending…' : 'Send Request'}
          </button>
        </form>
      </Panel>

      <Panel title="Your Requests">
        {loading ? (
          <TableSkeleton rows={3} cols={2} />
        ) : requests.length === 0 ? (
          <EmptyState icon={FileSignature} message="No requests yet." />
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 border-b border-ink-800 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm text-ink-100">{r.description}</p>
                  <p className="mt-1 text-xs text-ink-500">{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

export default PortalRequestQuotePage
