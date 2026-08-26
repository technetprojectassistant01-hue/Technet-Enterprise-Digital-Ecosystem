import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Check, X } from 'lucide-react'
import * as api from '../lib/api'
import type { MarketingCampaign, MarketingPost, MarketingPlatform } from '../lib/api'
import { MARKETING_PLATFORMS } from '../lib/api'
import { Panel, Badge, Modal, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, MARKETING_ROLES } from '../lib/permissions'
import { marketingPostStatusTone } from '../erp/statusTones'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

interface PostFormState {
  title: string
  platform: MarketingPlatform
  copy: string
  scheduledDate: string
}

const EMPTY_POST_FORM: PostFormState = { title: '', platform: 'LinkedIn', copy: '', scheduledDate: '' }

function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, MARKETING_ROLES)

  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddPost, setShowAddPost] = useState(false)
  const [postForm, setPostForm] = useState<PostFormState>(EMPTY_POST_FORM)
  const [postFormError, setPostFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    if (!id) return
    setLoading(true)
    api
      .getMarketingCampaign(id)
      .then(({ campaign }) => setCampaign(campaign))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load campaign'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  function openAddPost() {
    setPostForm(EMPTY_POST_FORM)
    setPostFormError(null)
    setShowAddPost(true)
  }

  async function handleAddPost(e: FormEvent) {
    e.preventDefault()
    setPostFormError(null)

    if (!id) return
    if (!postForm.title.trim()) {
      setPostFormError('Post title is required')
      return
    }
    if (!postForm.scheduledDate) {
      setPostFormError('A scheduled date is required')
      return
    }

    setSubmitting(true)
    try {
      await api.createMarketingPost(id, {
        title: postForm.title,
        platform: postForm.platform,
        copy: postForm.copy || undefined,
        scheduledDate: postForm.scheduledDate,
      })
      toast.success('Post added')
      setShowAddPost(false)
      load()
    } catch (err) {
      setPostFormError(err instanceof Error ? err.message : 'Failed to add post')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMarkPosted(post: MarketingPost) {
    try {
      await api.markMarketingPostPosted(post.id)
      toast.success(`Marked "${post.title}" as posted`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update post')
    }
  }

  async function handleCancelPost(post: MarketingPost) {
    try {
      await api.updateMarketingPost(post.id, { status: 'CANCELLED' })
      toast.success(`Cancelled "${post.title}"`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update post')
    }
  }

  async function handleDeletePost(post: MarketingPost) {
    const ok = await confirm({
      title: 'Delete post',
      message: `Delete "${post.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteMarketingPost(post.id)
      toast.success('Post deleted')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete post')
    }
  }

  if (loading) return <TableSkeleton rows={6} cols={4} />
  if (error || !campaign) return <EmptyState icon={X} message={error || 'Campaign not found'} />

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/marketing/campaigns"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaigns
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-ink-100">{campaign.name}</h1>
        {campaign.description && <p className="mt-1 text-sm text-ink-300">{campaign.description}</p>}
        <p className="mt-1 text-xs text-ink-400">
          {campaign.startDate ? campaign.startDate.slice(0, 10) : 'No start date'}
          {campaign.endDate ? ` – ${campaign.endDate.slice(0, 10)}` : ''}
        </p>
      </div>

      <Panel
        title="Content Posts"
        action={
          canWrite && (
            <button type="button" onClick={openAddPost} className={primaryButtonClass}>
              <Plus className="h-4 w-4" />
              Add Post
            </button>
          )
        }
      >
        {!campaign.posts || campaign.posts.length === 0 ? (
          <EmptyState icon={Plus} message="No posts planned yet for this campaign." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">SCHEDULED</th>
                  <th className="px-3 py-3 font-semibold">TITLE</th>
                  <th className="px-3 py-3 font-semibold">PLATFORM</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  {canWrite && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {campaign.posts.map((p) => (
                  <tr key={p.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-300">{p.scheduledDate.slice(0, 10)}</td>
                    <td className="px-3 py-3 font-medium text-ink-100">{p.title}</td>
                    <td className="px-3 py-3 text-ink-300">{p.platform}</td>
                    <td className="px-3 py-3">
                      <Badge tone={marketingPostStatusTone[p.status]}>{p.status}</Badge>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-3 text-ink-400">
                          {p.status === 'PLANNED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleMarkPosted(p)}
                                aria-label="Mark as posted"
                                className="hover:text-emerald-400"
                                title="Mark Posted"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelPost(p)}
                                aria-label="Cancel post"
                                className="hover:text-amber-400"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeletePost(p)}
                            aria-label="Delete post"
                            className="hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showAddPost && (
        <Modal title="Add Post" onClose={() => setShowAddPost(false)}>
          <form onSubmit={handleAddPost} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>TITLE</label>
              <input
                value={postForm.title}
                onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>PLATFORM</label>
                <select
                  value={postForm.platform}
                  onChange={(e) => setPostForm({ ...postForm, platform: e.target.value as MarketingPlatform })}
                  className={`mt-2 ${inputClass}`}
                >
                  {MARKETING_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>SCHEDULED DATE</label>
                <input
                  type="date"
                  value={postForm.scheduledDate}
                  onChange={(e) => setPostForm({ ...postForm, scheduledDate: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>COPY</label>
              <textarea
                value={postForm.copy}
                onChange={(e) => setPostForm({ ...postForm, copy: e.target.value })}
                rows={4}
                placeholder="Draft text for this post..."
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {postFormError && <p className="text-sm text-red-400">{postFormError}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setShowAddPost(false)} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className={`flex-1 justify-center py-2.5 ${primaryButtonClass}`}>
                {submitting ? 'Saving…' : 'Add Post'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default CampaignDetailPage
