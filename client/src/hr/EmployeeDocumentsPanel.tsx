import { useEffect, useState } from 'react'
import { Download, IdCard } from 'lucide-react'
import * as api from '../lib/api'
import type { EmployeeDocument } from '../lib/api'
import { Panel, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { downloadAuthenticated } from '../MyDocumentsPage'
import { useT } from '../i18n'

/**
 * The documents an employee uploaded themselves on My Documents (licence, ID, passport…), shown to
 * HR on the employee profile. Read-only: the employee manages their own files.
 */
function EmployeeDocumentsPanel({ employeeId }: { employeeId: string }) {
  const t = useT()
  const toast = useToast()
  const [documents, setDocuments] = useState<EmployeeDocument[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    api
      .listEmployeeDocuments(employeeId)
      .then(({ documents }) => setDocuments(documents))
      .catch(() => setDocuments([]))
  }, [employeeId])

  async function handleDownload(doc: EmployeeDocument) {
    setBusyId(doc.id)
    try {
      await downloadAuthenticated(api.employeeDocumentDownloadUrl(doc.id), doc.fileName)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.myDocuments.downloadFailed)
    } finally {
      setBusyId(null)
    }
  }

  const dateFormat = new Intl.DateTimeFormat(t.shared.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })
  const formatDay = (iso: string) => dateFormat.format(new Date(`${iso.slice(0, 10)}T12:00:00`))

  return (
    <Panel title={t.myDocuments.hrPanelTitle} icon={IdCard}>
      {documents === null ? (
        <TableSkeleton rows={2} cols={2} />
      ) : documents.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">{t.myDocuments.hrEmpty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink-800">
          {documents.map((doc) => {
            return (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-100">{doc.title || t.myDocuments.types[doc.type]}</div>
                  <div className="truncate text-xs text-ink-400">
                    {t.myDocuments.types[doc.type]} · {t.myDocuments.addedOn(formatDay(doc.createdAt))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    disabled={busyId === doc.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-semibold text-ink-200 transition hover:border-cyan-accent hover:text-cyan-accent disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t.myDocuments.download}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export default EmployeeDocumentsPanel
