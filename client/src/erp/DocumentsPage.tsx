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
  const customers = useCustomers()
  const projects = useProjects()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | ''>('')

  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('GENERAL')
  const [projectId, setProjectId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function load(category = categoryFilter) {
    setLoading(true)
    api
      .listDocuments({ category: category || undefined })
      .then(({ documents }) => setDocuments(documents))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load documents'))
      .finally(() => setLoading(false))
  }

  useEffect(() => load(), []) // eslint-disable-line react-hooks/exhaustive-deps

  function changeFilter(next: DocumentCategory | '') {
    setCategoryFilter(next)
    load(next)
  }

  function openUpload() {
    setTitle('')
    setCategory('GENERAL')
    setProjectId('')
    setCustomerId('')
    setFile(null)
    setFileError(null)
    setFormError(null)
    setShowUpload(true)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    const selected = e.target.files?.[0] || null
    if (selected && selected.size > MAX_FILE_BYTES) {
      setFileError('File must be 15MB or smaller')
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
      setFormError('Title is required')
      return
    }
    if (!file) {
      setFormError('Choose a file to upload')
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
      toast.success('Document uploaded')
      setShowUpload(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to upload document')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(doc: Document) {
    const ok = await confirm({
      title: 'Delete document',
      message: `Delete "${doc.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteDocument(doc.id)
      toast.success('Document deleted')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete document')
    }
  }

  const totalSize = documents.reduce((sum, d) => sum + d.sizeBytes, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Document Management</h1>
          <p className="mt-1 text-sm text-ink-300">Central archive for contracts, invoices, and project files.</p>
        </div>
        {canWrite && (
          <button type="button" onClick={openUpload} className={primaryButtonClass}>
            <Upload className="h-4 w-4" />
            Upload Document
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatCard label="TOTAL DOCUMENTS" value={documents.length} icon={FileText} />
        <StatCard label="STORAGE USED" value={formatSize(totalSize)} icon={FileText} />
      </div>

      <Panel title="Document Archive">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => changeFilter('')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              categoryFilter === '' ? 'bg-cyan-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'
            }`}
          >
            All
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
              {DOCUMENT_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : documents.length === 0 ? (
          <EmptyState icon={FileText} message="No documents yet. Upload your first document to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">TITLE</th>
                  <th className="px-3 py-3 font-semibold">CATEGORY</th>
                  <th className="px-3 py-3 font-semibold">LINKED TO</th>
                  <th className="px-3 py-3 font-semibold">SIZE</th>
                  <th className="px-3 py-3 font-semibold">UPLOADED</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 font-medium text-ink-100">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                        {doc.title}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-500">{doc.fileName}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={categoryTone[doc.category]}>{DOCUMENT_CATEGORY_LABELS[doc.category]}</Badge>
                    </td>
                    <td className="px-3 py-3 text-ink-300">
                      {doc.project?.name || (doc.customer && (doc.customer.company || doc.customer.name)) || '—'}
                    </td>
                    <td className="px-3 py-3 text-ink-400">{formatSize(doc.sizeBytes)}</td>
                    <td className="px-3 py-3 text-ink-400">
                      {doc.createdAt.slice(0, 10)}
                      {doc.uploadedBy.name && <span className="text-ink-500"> · {doc.uploadedBy.name}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        <a
                          href={api.documentDownloadUrl(doc.id)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Download document"
                          className="hover:text-cyan-accent"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        {canWrite && (
                          <button type="button" onClick={() => handleDelete(doc)} aria-label="Delete document" className="hover:text-red-400">
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
        <Modal title="Upload Document" onClose={() => setShowUpload(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>FILE</label>
              <div className="mt-2 flex items-center gap-3 rounded-md border border-dashed border-ink-600 bg-ink-950 px-4 py-3">
                <Paperclip className="h-4 w-4 shrink-0 text-ink-400" />
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full text-sm text-ink-300 file:mr-3 file:rounded file:border-0 file:bg-ink-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-200"
                />
              </div>
              {fileError && <p className="mt-1 text-xs text-red-400">{fileError}</p>}
              <p className="mt-1 text-xs text-ink-500">Any document type. Max 15MB.</p>
            </div>
            <div>
              <label className={labelClass}>TITLE</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required className={`mt-2 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>CATEGORY</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)} className={`mt-2 ${inputClass}`}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DOCUMENT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>PROJECT (OPTIONAL)</label>
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
                <label className={labelClass}>CUSTOMER (OPTIONAL)</label>
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
              {submitting ? 'Uploading…' : 'Upload Document'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default DocumentsPage
