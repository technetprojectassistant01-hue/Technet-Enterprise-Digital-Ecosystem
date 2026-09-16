import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Download, FileText, IdCard, Lock, Plus, Trash2, Upload } from 'lucide-react'
import * as api from './lib/api'
import type { EmployeeDocument, EmployeeDocumentType } from './lib/api'
import { Panel, Modal, EmptyState, TableSkeleton } from './dashboard/ui'
import { inputClass, labelClass, primaryButtonClass } from './dashboard/buttonStyles'
import PageTitle from './dashboard/PageTitle'
import { useToast } from './dashboard/ToastContext'
import { useConfirm } from './dashboard/ConfirmContext'
import { useAuth } from './context/AuthContext'
import { useT } from './i18n'

export const EMPLOYEE_DOCUMENT_TYPES: EmployeeDocumentType[] = [
  'DRIVING_LICENCE',
  'NATIONAL_ID',
  'PASSPORT',
  'CERTIFICATE',
  'MEDICAL',
  'OTHER',
]
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Downloads a file from an authenticated URL (fetch + blob, so the cookie always goes with it). */
export async function downloadAuthenticated(url: string, fileName: string) {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  const blobUrl = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
}

/**
 * My Documents: an employee keeps their own driving licence, ID card, passport, certificates and
 * similar here. Private — only they and HR can see them (HR on the employee's profile).
 */
function MyDocumentsPage() {
  const t = useT()
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()

  const [documents, setDocuments] = useState<EmployeeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState<EmployeeDocumentType | ''>('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  function load() {
    setLoading(true)
    api
      .listMyDocuments()
      .then(({ documents }) => setDocuments(documents))
      .catch((err) => setError(err instanceof Error ? err.message : t.myDocuments.loadFailed))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user?.employeeId) load()
  }, [user?.employeeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // An admin has no personal documents page of their own: they read everyone else's on the HR
  // employee profile. An old bookmark still lands somewhere useful.
  if (user?.role === 'ADMIN') {
    return <Navigate to="/dashboard/hr/employees" replace />
  }

  if (!user?.employeeId) return <EmptyState icon={Lock} message={t.myDocuments.notLinked} />

  function openForm() {
    setType('')
    setTitle('')
    setFile(null)
    setFormError(null)
    setShowForm(true)
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!title.trim()) return setFormError(t.myDocuments.nameRequired)
    if (!type) return setFormError(t.myDocuments.chooseType)
    if (!file) return setFormError(t.myDocuments.chooseFile)
    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) return setFormError(t.myDocuments.photoOrPdf)
    if (file.size > 10 * 1024 * 1024) return setFormError(t.myDocuments.tooLarge)

    setUploading(true)
    try {
      await api.uploadMyDocument({
        type,
        title: title.trim(),
        fileName: file.name,
        fileData: await readFileAsDataUrl(file),
      })
      toast.success(t.myDocuments.uploaded)
      setShowForm(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.myDocuments.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(doc: EmployeeDocument) {
    setBusyId(doc.id)
    try {
      await downloadAuthenticated(api.myDocumentDownloadUrl(doc.id), doc.fileName)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myDocuments.downloadFailed)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(doc: EmployeeDocument) {
    const ok = await confirm({
      title: t.myDocuments.deleteTitle,
      message: t.myDocuments.deleteMessage(doc.title || t.myDocuments.types[doc.type]),
      confirmLabel: t.shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    setBusyId(doc.id)
    try {
      await api.deleteMyDocument(doc.id)
      toast.success(t.myDocuments.deleted)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myDocuments.deleteFailed)
    } finally {
      setBusyId(null)
    }
  }

  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })
  const formatDay = (iso: string) => dateFormat.format(new Date(`${iso.slice(0, 10)}T12:00:00`))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle icon={IdCard} title={t.myDocuments.title} subtitle={t.myDocuments.subtitle} />
        <button type="button" onClick={openForm} className={primaryButtonClass}>
          <Plus className="h-4 w-4" />
          {t.myDocuments.upload}
        </button>
      </div>

      <Panel title={t.myDocuments.title} icon={FileText}>
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {loading ? (
          <TableSkeleton rows={3} cols={3} />
        ) : documents.length === 0 ? (
          <EmptyState icon={IdCard} message={t.myDocuments.empty} />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {documents.map((doc) => {
              return (
                <li key={doc.id} className="flex flex-col gap-3 rounded-xl border border-ink-800 bg-ink-950 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-accent/10 text-cyan-accent">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-ink-100">{doc.title || t.myDocuments.types[doc.type]}</div>
                      {doc.title && <div className="text-xs text-ink-300">{t.myDocuments.types[doc.type]}</div>}
                      <div className="mt-1 truncate text-xs text-ink-400">
                        {doc.fileName} · {formatSize(doc.sizeBytes)} · {t.myDocuments.addedOn(formatDay(doc.createdAt))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(doc)}
                        disabled={busyId === doc.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition hover:border-cyan-accent hover:text-cyan-accent disabled:opacity-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t.myDocuments.download}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        disabled={busyId === doc.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition hover:border-red-400 hover:text-red-400 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t.shared.delete}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-400">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          {t.myDocuments.privacyNote}
        </p>
      </Panel>

      {showForm && (
        <Modal title={t.myDocuments.upload} onClose={() => setShowForm(false)}>
          <form onSubmit={handleUpload} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.myDocuments.titleLabel}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.myDocuments.titlePlaceholder}
                maxLength={120}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{t.myDocuments.typeLabel}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EmployeeDocumentType | '')}
                className={`mt-2 ${inputClass}`}
                required
              >
                <option value="">{t.myDocuments.chooseType}</option>
                {EMPLOYEE_DOCUMENT_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {t.myDocuments.types[dt]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t.myDocuments.fileLabel}</label>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="mt-2 flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-600 bg-ink-950 px-4 py-6 text-sm text-ink-300 transition hover:border-cyan-accent hover:text-cyan-accent"
              >
                <Upload className="h-5 w-5" />
                {file ? (
                  <span className="max-w-full truncate font-medium text-ink-100">
                    {file.name} · {formatSize(file.size)}
                  </span>
                ) : (
                  <span>{t.myDocuments.pickFile}</span>
                )}
              </button>
              <p className="mt-1 text-xs text-ink-400">{t.myDocuments.fileHint}</p>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={uploading} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {uploading ? t.myDocuments.uploading : t.myDocuments.upload}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default MyDocumentsPage
