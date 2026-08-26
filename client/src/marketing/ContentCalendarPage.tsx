import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CalendarDays } from 'lucide-react'
import * as api from '../lib/api'
import type { MarketingPost, MarketingPostStatus, MarketingPlatform } from '../lib/api'
import { MARKETING_PLATFORMS } from '../lib/api'
import { Panel, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, MARKETING_ROLES } from '../lib/permissions'
import { marketingPostStatusTone } from '../erp/statusTones'

const inputClass =
  'rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const STATUSES: MarketingPostStatus[] = ['PLANNED', 'POSTED', 'CANCELLED']

// Deliberately a plain filterable table, not a calendar-grid widget - Technet's real posting
// volume is low (see the Phase 1 scoping doc). A visual month/week grid is a possible future
// enhancement, not required now.
function ContentCalendarPage() {
  const toast = useToast()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, MARKETING_ROLES)

  const [posts, setPosts] = useState<MarketingPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<MarketingPostStatus | ''>('')
  const [platform, setPlatform] = useState<MarketingPlatform | ''>('')

  function load() {
    setLoading(true)
    api
      .listMarketingPosts({
        from: from || undefined,
        to: to || undefined,
        status: status || undefined,
        platform: platform || undefined,
      })
      .then(({ posts }) => setPosts(posts))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load posts'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [from, to, status, platform]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleMarkPosted(post: MarketingPost) {
    try {
      await api.markMarketingPostPosted(post.id)
      toast.success(`Marked "${post.title}" as posted`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update post')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Content Calendar</h1>
        <p className="mt-1 text-sm text-ink-300">All planned posts across every campaign, sorted by date.</p>
      </div>

      <Panel title="Planned & Posted Content">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>FROM</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>TO</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>STATUS</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as MarketingPostStatus | '')} className={inputClass}>
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>PLATFORM</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as MarketingPlatform | '')} className={inputClass}>
              <option value="">All</option>
              {MARKETING_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {(from || to || status || platform) && (
            <button
              type="button"
              onClick={() => {
                setFrom('')
                setTo('')
                setStatus('')
                setPlatform('')
              }}
              className="text-xs font-semibold text-ink-400 hover:text-ink-100"
            >
              Clear filters
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={5} />
        ) : posts.length === 0 ? (
          <EmptyState icon={CalendarDays} message="No posts match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">SCHEDULED</th>
                  <th className="px-3 py-3 font-semibold">TITLE</th>
                  <th className="px-3 py-3 font-semibold">CAMPAIGN</th>
                  <th className="px-3 py-3 font-semibold">PLATFORM</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-300">{p.scheduledDate.slice(0, 10)}</td>
                    <td className="px-3 py-3 font-medium text-ink-100">{p.title}</td>
                    <td className="px-3 py-3 text-ink-300">
                      {p.campaign ? (
                        <Link to={`/dashboard/marketing/campaigns/${p.campaign.id}`} className="hover:text-cyan-accent">
                          {p.campaign.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-300">{p.platform}</td>
                    <td className="px-3 py-3">
                      <Badge tone={marketingPostStatusTone[p.status]}>{p.status}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        {p.status === 'PLANNED' && (
                          <button
                            type="button"
                            onClick={() => handleMarkPosted(p)}
                            aria-label="Mark as posted"
                            className="flex items-center gap-1 text-ink-400 hover:text-emerald-400"
                            title="Mark Posted"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
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

export default ContentCalendarPage
