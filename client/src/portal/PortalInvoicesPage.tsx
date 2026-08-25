import { useEffect, useState } from 'react'
import { Download, Receipt } from 'lucide-react'
import * as api from '../lib/api'
import type { Invoice } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { invoiceStatusTone } from '../erp/statusTones'
import { formatMoney } from '../lib/format'
import { useToast } from '../dashboard/ToastContext'

function PortalInvoicesPage() {
  const toast = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function handleDownloadPdf(inv: Invoice) {
    setDownloadingId(inv.id)
    try {
      const res = await fetch(api.portalInvoicePdfUrl(inv.id), { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to download PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${inv.invoiceNumber}.pdf`
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
      .portalListInvoices()
      .then(({ invoices }) => setInvoices(invoices))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load invoices'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <TableSkeleton rows={5} cols={4} />
  if (error) return <EmptyState icon={Receipt} message={error} />

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Invoices</h1>
        <p className="mt-1 text-sm text-ink-300">Invoices and receipts issued to you.</p>
      </div>
      <Panel className="p-0">
        {invoices.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Receipt} message="No invoices yet." />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                <th className="px-5 py-3 font-semibold">NUMBER</th>
                <th className="px-5 py-3 font-semibold">STATUS</th>
                <th className="px-5 py-3 font-semibold">TOTAL</th>
                <th className="px-5 py-3 font-semibold">ISSUED</th>
                <th className="px-5 py-3 font-semibold">DUE</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-ink-800 last:border-0">
                  <td className="px-5 py-3 font-mono text-ink-300">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3">
                    <Badge tone={invoiceStatusTone[inv.status]}>{inv.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-ink-100">{formatMoney(inv.total)}</td>
                  <td className="px-5 py-3 text-ink-400">{new Date(inv.issueDate).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-ink-400">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(inv)}
                      disabled={downloadingId === inv.id}
                      className="flex items-center gap-1.5 text-xs text-cyan-accent hover:underline disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {downloadingId === inv.id ? 'Downloading…' : 'PDF'}
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

export default PortalInvoicesPage
