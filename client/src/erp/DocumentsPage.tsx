import { useEffect, useState, type FormEvent } from 'react'
import { Upload, Download, Trash2, FileText, Paperclip } from 'lucide-react'
import * as api from '../lib/api'
import type { Document, DocumentCategory } from '../lib/api'
import { DOCUMENT_CATEGORY_LABELS } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { primaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, DOCUMENT_ROLES } from '../lib/permissions'
import { useCustomers } from './useCustomers'
import { useProjects } from './useProjects'
import { useT } from '../i18n'
import { useFormDraft } from '../lib/useFormDraft'
import { DraftNotice } from '../dashboard/DraftNotice'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const CATEGORIES = Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]
const MAX_FILE_BYTES = 15 * 1024 * 1024

const categoryTone: Record<DocumentCategory, 'neutral' | 'accent' | 'warning' | 'success' | 'danger'> = {
  CONTRACT: 'accent',
  INVOICE: 'warning',
  HR: 'neutral',
  PROJECT: 'success',
  GENERAL: 'neutral',
  QUOTATION: 'accent',
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function DocumentsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const canWrite = hasRole(user?.role, DOCUMENT_ROLES)
  const { documents: m, shared } = useT().erp
  const customers = useCustomers()
  const projects = useProjects()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | ''>('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('GENERAL')
  const [projectId, setProjectId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const draftValue = { title, category, projectId, customerId }
  const draft = useFormDraft('document', draftValue, showUpload)

  function load(category = categoryFilter) {
    setLoading(true)
    api
      .listDocuments({ category: category || undefined })
      .then(({ documents }) => setDocuments(documents))
      .catch((err) => setError(err instanceof Error ? err.message : m.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), []) // eslint-disable-line react-hooks/exhaustive-deps

  function changeFilter(next: DocumentCategory | '') {
    setCategoryFilter(next)
    load(next)
  }

  function fillDraft(d: typeof draftValue) {
    setTitle(d.title)
    setCategory(d.category)
    setProjectId(d.projectId)
    setCustomerId(d.customerId)
  }

  function openUpload() {
    fillDraft(draft.take({
      title: '',
      category: 'GENERAL' as DocumentCategory,
      projectId: '',
      customerId: '',
    }))
    setFile(null)
    setFileError(null)
    setFormError(null)
    setShowUpload(true)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    const selected = e.target.files?.[0] || null
    if (selected && selected.size > MAX_FILE_BYTES) {
      setFileError(m.fileTooBig)
      setFile(null)
      e.target.value = ''
      return
    }
    setFile(selected)
    if (selected && !title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, ''))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!title.trim()) {
      setFormError(m.titleRequired)
      return
    }
    if (!file) {
      setFormError(m.chooseFile)
      return
    }

    setSubmitting(true)
    try {
      const fileData = await readFileAsDataUrl(file)
      await api.createDocument({
        title,
        category,
        projectId: projectId || undefined,
        customerId: customerId || undefined,
        fileData,
        fileName: file.name,
      })
      draft.clear()
      toast.success(m.uploaded)
      setShowUpload(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : m.uploadFailed)
    } finally {
      setSubmitting(false)
    }
  }

  // Cross-origin cookie download - can't be a plain <a href target="_blank"> (prod auth cookies
  // are SameSite=None; Partitioned, which aren't sent on a direct top-level navigation). See
  // CLAUDE.md §9's "PDF/file download buttons" note - same fix already applied to every PDF
  // download in the app, just missed here since documents aren't PDF-only.
  async function handleDownload(doc: Document) {
    setDownloadingId(doc.id)
    try {
      const res = await fetch(api.documentDownloadUrl(doc.id), { credentials: 'include' })
      if (!res.ok) throw new Error(m.downloadFailed)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.downloadFailed)
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDelete(doc: Document) {
    const ok = await confirm({
      title: m.deleteTitle,
      message: m.deleteMessage(doc.title),
      confirmLabel: shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteDocument(doc.id)
      toast.success(m.deleted)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : m.deleteFailed)
    }
  }

  const totalSize = documents.reduce((sum, d) => sum + d.sizeBytes, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">{m.title}</h1>
          <p className="mt-1 text-sm text-ink-300">{m.subtitle}</p>
        </div>
        {canWrite && (
          <button type="button" onClick={openUpload} className={primaryButtonClass}>
            <Upload className="h-4 w-4" />
            {m.upload}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label={m.statTotal} value={documents.length} icon={FileText} />
        <StatCard label={m.statStorage} value={formatSize(totalSize)} icon={FileText} />
      </div>

      <Panel title={m.panel}>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => changeFilter('')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              categoryFilter === '' ? 'bg-cyan-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
            }`}
          >
            {m.all}
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => changeFilter(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                categoryFilter === c ? 'bg-cyan-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
              }`}
            >
              {m.categories[c]}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : documents.length === 0 ? (
          <EmptyState icon={FileText} message={m.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{m.colTitle}</th>
                  <th className="px-3 py-3 font-semibold">{m.colCategory}</th>
                  <th className="px-3 py-3 font-semibold">{m.colLinked}</th>
                  <th className="px-3 py-3 font-semibold">{m.colSize}</th>
                  <th className="px-3 py-3 font-semibold">{m.colUploaded}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 font-medium text-ink-100">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                        {doc.title}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-400">{doc.fileName}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={categoryTone[doc.category]}>{m.categories[doc.category]}</Badge>
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      {doc.project?.name || (doc.customer && (doc.customer.company || doc.customer.name)) || '—'}
                    </td>
                    <td className="px-3 py-3 text-ink-400">{formatSize(doc.sizeBytes)}</td>
                    <td className="px-3 py-3 text-ink-400">
                      {doc.createdAt.slice(0, 10)}
                      {doc.uploadedBy.name && <span className="text-ink-400"> · {doc.uploadedBy.name}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        <button
                          type="button"
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          aria-label={m.downloadAria}
                          className="hover:text-cyan-accent disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {canWrite && (
                          <button type="button" onClick={() => handleDelete(doc)} aria-label={m.deleteAria} className="hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showUpload && (
        <Modal title={m.upload} onClose={() => setShowUpload(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {draft.restored && <DraftNotice files onDiscard={() => fillDraft(draft.discard())} />}
            <div>
              <label className={labelClass}>{m.file}</label>
              <div className="mt-2 flex items-center gap-3 rounded-md border border-dashed border-ink-600 bg-ink-950 px-4 py-3">
                <Paperclip className="h-4 w-4 shrink-0 text-ink-400" />
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full text-sm text-ink-300 file:mr-3 file:rounded file:border-0 file:bg-ink-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-200"
                />
              </div>
              {fileError && <p className="mt-1 text-xs text-red-400">{fileError}</p>}
              <p className="mt-1 text-xs text-ink-400">{m.fileHint}</p>
            </div>
            <div>
              <label className={labelClass}>{m.titleLabel}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required className={`mt-2 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>{m.category}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)} className={`mt-2 ${inputClass}`}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {m.categories[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{shared.projectOptional}</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{m.customerOptional}</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">—</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? m.uploading : m.upload}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default DocumentsPage
