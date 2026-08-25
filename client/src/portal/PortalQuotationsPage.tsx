import { useEffect, useState } from 'react'
import { Download, FileSignature } from 'lucide-react'
import * as api from '../lib/api'
import type { Quotation } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { quotationStatusTone } from '../erp/statusTones'
import { formatMoney } from '../lib/format'
import { useToast } from '../dashboard/ToastContext'

function PortalQuotationsPage() {
  const toast = useToast()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function handleDownloadPdf(q: Quotation) {
    setDownloadingId(q.id)
    try {
      const res = await fetch(api.portalQuotationPdfUrl(q.id), { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to download PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${q.quotationNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  useEffect(() => {
    api
      .portalListQuotations()
      .then(({ quotations }) => setQuotations(quotations))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load quotations'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <TableSkeleton rows={5} cols={4} />
  if (error) return <EmptyState icon={FileSignature} message={error} />

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Quotations</h1>
        <p className="mt-1 text-sm text-ink-300">Quotations we've sent you.</p>
      </div>
      <Panel className="p-0">
        {quotations.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={FileSignature} message="No quotations yet." />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                <th className="px-5 py-3 font-semibold">NUMBER</th>
                <th className="px-5 py-3 font-semibold">TITLE</th>
                <th className="px-5 py-3 font-semibold">STATUS</th>
                <th className="px-5 py-3 font-semibold">TOTAL</th>
                <th className="px-5 py-3 font-semibold">ISSUED</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr key={q.id} className="border-b border-ink-800 last:border-0">
                  <td className="px-5 py-3 font-mono text-ink-300">{q.quotationNumber}</td>
                  <td className="px-5 py-3 text-ink-100">{q.title}</td>
                  <td className="px-5 py-3">
                    <Badge tone={quotationStatusTone[q.status]}>{q.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-ink-100">{formatMoney(q.total)}</td>
                  <td className="px-5 py-3 text-ink-400">{new Date(q.issuedAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(q)}
                      disabled={downloadingId === q.id}
                      className="flex items-center gap-1.5 text-xs text-cyan-accent hover:underline disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {downloadingId === q.id ? 'Downloading…' : 'PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}

export default PortalQuotationsPage
