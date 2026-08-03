import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, X, ScrollText, History } from 'lucide-react'
import * as api from '../lib/api'
import type { AssetDetail } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { assetStatusTone, maintenanceContractStatusTone, scheduleStatusTone } from './statusTones'
import { reportStatusTone } from '../erp/statusTones'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function AssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api
      .getAsset(id)
      .then(({ asset }) => setAsset(asset))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load asset'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !asset) return <EmptyState icon={X} message={error || 'Asset not found'} />

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/maintenance/assets"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Assets
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold text-ink-100">{asset.assetNumber}</h1>
          <Badge tone={assetStatusTone[asset.status]}>{asset.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-ink-300">
          {asset.name} · {asset.customer.company || asset.customer.name}
          {asset.location && ` · ${asset.location}`}
        </p>
        {asset.notes && <p className="mt-2 max-w-2xl text-sm text-ink-400">{asset.notes}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Panel title="Asset Details">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-semibold tracking-widest text-ink-400">CATEGORY</dt>
              <dd className="mt-1 text-sm text-ink-100">{asset.category || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-widest text-ink-400">SERIAL NUMBER</dt>
              <dd className="mt-1 font-mono text-sm text-ink-100">{asset.serialNumber || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-widest text-ink-400">LOCATION</dt>
              <dd className="mt-1 text-sm text-ink-100">{asset.location || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-widest text-ink-400">REGISTERED</dt>
              <dd className="mt-1 text-sm text-ink-100">{formatDate(asset.createdAt)}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Maintenance Contracts" icon={ScrollText}>
          {asset.contracts.length === 0 ? (
            <p className="text-sm text-ink-400">No contracts on this asset yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {asset.contracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-ink-800 px-4 py-2.5">
                  <div>
                    <span className="font-mono text-sm text-ink-100">{c.contractNumber}</span>
                    <span className="ml-2 text-xs text-ink-400">{c.frequency.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-400">Expires {formatDate(c.expiryDate)}</span>
                    <Badge tone={maintenanceContractStatusTone[c.status]}>{c.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Service History" icon={History}>
        {asset.schedules.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">No maintenance visits recorded for this asset yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">DATE</th>
                  <th className="px-3 py-3 font-semibold">TYPE</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  <th className="px-3 py-3 font-semibold">REMARKS</th>
                  <th className="px-3 py-3 font-semibold">REPORT STATUS</th>
                </tr>
              </thead>
              <tbody>
                {asset.schedules.map((s) => (
                  <tr key={s.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-100">{formatDate(s.scheduledDate)}</td>
                    <td className="px-3 py-3 text-ink-300">{s.contract ? 'Preventive' : 'Corrective'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={scheduleStatusTone[s.status]}>{s.status}</Badge>
                    </td>
                    <td className="px-3 py-3 max-w-sm truncate text-ink-300" title={s.report?.remarks || ''}>
                      {s.report?.remarks || '—'}
                    </td>
                    <td className="px-3 py-3">
                      {s.report ? <Badge tone={reportStatusTone[s.report.status]}>{s.report.status}</Badge> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

export default AssetDetailPage
