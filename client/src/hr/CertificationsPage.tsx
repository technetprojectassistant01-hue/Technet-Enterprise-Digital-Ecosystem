import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search, BadgeCheck, GraduationCap, Lock } from 'lucide-react'
import * as api from '../lib/api'
import type { Certification, TrainingRecord } from '../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { useFormDraft } from '../lib/useFormDraft'
import { DraftNotice } from '../dashboard/DraftNotice'
import { useConfirm } from '../dashboard/ConfirmContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, HR_ROLES } from '../lib/permissions'
import { useEmployees } from '../erp/useEmployees'
import { formatMoney } from '../lib/format'
import { inputClass, labelClass, primaryButtonClass } from './formStyles'
import {
  certificationState,
  certificationStateTone,
  daysUntilExpiry,
} from './certificationStatus'
import { useT, type Dict } from '../i18n'

type View = 'certifications' | 'training'

function statusFilters(c: Dict['people']['certifications']): { value: '' | 'valid' | 'expiring' | 'expired'; label: string }[] {
  return [
    { value: '', label: c.filterAll },
    { value: 'expiring', label: c.filterExpiring },
    { value: 'expired', label: c.filterExpired },
    { value: 'valid', label: c.filterValid },
  ]
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}

interface CertFormState {
  employeeId: string
  name: string
  category: string
  issuingBody: string
  certificateNumber: string
  issueDate: string
  expiryDate: string
  notes: string
}

const EMPTY_CERT: CertFormState = {
  employeeId: '',
  name: '',
  category: '',
  issuingBody: '',
  certificateNumber: '',
  issueDate: '',
  expiryDate: '',
  notes: '',
}

interface TrainingFormState {
  employeeId: string
  title: string
  provider: string
  completedDate: string
  durationHours: string
  cost: string
  notes: string
}

const EMPTY_TRAINING: TrainingFormState = {
  employeeId: '',
  title: '',
  provider: '',
  completedDate: '',
  durationHours: '',
  cost: '',
  notes: '',
}

function CertificationsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { user } = useAuth()
  const t = useT()
  const c = t.people.certifications
  const locale = t.shared.dateLocale
  const canAccess = hasRole(user?.role, HR_ROLES)
  const employees = useEmployees()

  const [view, setView] = useState<View>('certifications')

  const [certifications, setCertifications] = useState<Certification[]>([])
  const [training, setTraining] = useState<TrainingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | 'valid' | 'expiring' | 'expired'>('')
  const [employeeId, setEmployeeId] = useState('')

  const [certForm, setCertForm] = useState<CertFormState>(EMPTY_CERT)
  const [editingCert, setEditingCert] = useState<Certification | null>(null)
  const [showCertForm, setShowCertForm] = useState(false)
  const certDraft = useFormDraft('certification', certForm, showCertForm && !editingCert)

  const [trainingForm, setTrainingForm] = useState<TrainingFormState>(EMPTY_TRAINING)
  const [editingTraining, setEditingTraining] = useState<TrainingRecord | null>(null)
  const [showTrainingForm, setShowTrainingForm] = useState(false)
  const trainingDraft = useFormDraft('training-record', trainingForm, showTrainingForm && !editingTraining)

  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    (overrides: { search?: string; status?: typeof status; employeeId?: string } = {}) => {
      if (!canAccess) return
      const params = {
        search: overrides.search ?? search,
        status: overrides.status ?? status,
        employeeId: overrides.employeeId ?? employeeId,
      }
      setLoading(true)
      setError(null)

      Promise.all([
        api.listCertifications({
          search: params.search || undefined,
          status: params.status || undefined,
          employeeId: params.employeeId || undefined,
        }),
        api.listTrainingRecords({
          search: params.search || undefined,
          employeeId: params.employeeId || undefined,
        }),
      ])
        .then(([certResult, trainingResult]) => {
          setCertifications(certResult.certifications)
          setTraining(trainingResult.records)
        })
        .catch((err) => setError(err instanceof Error ? err.message : c.loadFailed))
        .finally(() => setLoading(false))
    },
    [search, status, employeeId, canAccess, c],
  )

  useEffect(() => {
    load({ search: '', status: '', employeeId: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------------- certifications ---------------- */

  function openCertCreate() {
    setCertForm(certDraft.take(EMPTY_CERT))
    setEditingCert(null)
    setFormError(null)
    setShowCertForm(true)
  }

  function openCertEdit(certification: Certification) {
    setCertForm({
      employeeId: certification.employeeId,
      name: certification.name,
      category: certification.category || '',
      issuingBody: certification.issuingBody || '',
      certificateNumber: certification.certificateNumber || '',
      issueDate: certification.issueDate ? certification.issueDate.slice(0, 10) : '',
      expiryDate: certification.expiryDate ? certification.expiryDate.slice(0, 10) : '',
      notes: certification.notes || '',
    })
    setEditingCert(certification)
    setFormError(null)
    setShowCertForm(true)
  }

  async function handleCertSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!certForm.employeeId) return setFormError(c.selectEmployee)
    if (!certForm.name.trim()) return setFormError(c.certNameRequired)

    setSubmitting(true)
    try {
      if (editingCert) {
        await api.updateCertification(editingCert.id, certForm)
      } else {
        await api.createCertification(certForm)
        certDraft.clear()
      }
      toast.success(editingCert ? c.certUpdated : c.certAdded)
      setShowCertForm(false)
      setEditingCert(null)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : c.certSaveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCertDelete(certification: Certification) {
    const ok = await confirm({
      title: c.deleteCertTitle,
      message: c.deleteCertMessage(certification.name, `${certification.employee.firstName} ${certification.employee.lastName}`),
      confirmLabel: c.deleteConfirm,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteCertification(certification.id)
      toast.success(c.certDeleted)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.certDeleteFailed)
    }
  }

  /* ---------------- training ---------------- */

  function openTrainingCreate() {
    setTrainingForm(trainingDraft.take(EMPTY_TRAINING))
    setEditingTraining(null)
    setFormError(null)
    setShowTrainingForm(true)
  }

  function openTrainingEdit(record: TrainingRecord) {
    setTrainingForm({
      employeeId: record.employeeId,
      title: record.title,
      provider: record.provider || '',
      completedDate: record.completedDate ? record.completedDate.slice(0, 10) : '',
      durationHours: record.durationHours || '',
      cost: record.cost || '',
      notes: record.notes || '',
    })
    setEditingTraining(record)
    setFormError(null)
    setShowTrainingForm(true)
  }

  async function handleTrainingSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!trainingForm.employeeId) return setFormError(c.selectEmployee)
    if (!trainingForm.title.trim()) return setFormError(c.trainingTitleRequired)

    setSubmitting(true)
    try {
      if (editingTraining) {
        await api.updateTrainingRecord(editingTraining.id, trainingForm)
      } else {
        await api.createTrainingRecord(trainingForm)
        trainingDraft.clear()
      }
      toast.success(editingTraining ? c.trainingUpdated : c.trainingRecorded)
      setShowTrainingForm(false)
      setEditingTraining(null)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : c.trainingSaveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTrainingDelete(record: TrainingRecord) {
    const ok = await confirm({
      title: c.deleteTrainingTitle,
      message: c.deleteTrainingMessage(record.title),
      confirmLabel: c.deleteConfirm,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteTrainingRecord(record.id)
      toast.success(c.trainingDeleted)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.trainingDeleteFailed)
    }
  }

  const expiredCount = certifications.filter((cert) => certificationState(cert) === 'EXPIRED').length
  const expiringCount = certifications.filter((cert) => certificationState(cert) === 'EXPIRING').length

  if (!canAccess) {
    return <EmptyState icon={Lock} message={c.restricted} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'certifications', label: c.tabCertifications },
            { key: 'training', label: c.tabTraining },
          ] as { key: View; label: string }[]
        ).map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              view === v.key
                ? 'bg-cyan-accent/10 text-cyan-accent'
                : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
            }`}
          >
            {v.label}
          </button>
        ))}

        <button
          type="button"
          onClick={view === 'certifications' ? openCertCreate : openTrainingCreate}
          className={`ml-auto ${primaryButtonClass}`}
        >
          <Plus className="h-4 w-4" />
          {view === 'certifications' ? c.addCertification : c.recordTraining}
        </button>
      </div>

      {view === 'certifications' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={c.statCertifications} value={certifications.length} icon={BadgeCheck} />
          <StatCard label={c.statRenewSoon} value={expiringCount} deltaTone="warning" icon={BadgeCheck} />
          <StatCard label={c.statExpired} value={expiredCount} icon={BadgeCheck} />
        </div>
      )}

      <Panel title={view === 'certifications' ? c.panelCertifications : c.panelTraining}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder={
                view === 'certifications' ? c.searchCertifications : c.searchTraining
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              className="w-full bg-transparent text-sm text-ink-100 placeholder-ink-500 outline-none"
            />
          </div>

          <select
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value)
              load({ employeeId: e.target.value })
            }}
            className={`max-w-[16rem] ${inputClass}`}
          >
            <option value="">{c.allEmployees}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName}
              </option>
            ))}
          </select>

          {view === 'certifications' && (
            <select
              value={status}
              onChange={(e) => {
                const next = e.target.value as typeof status
                setStatus(next)
                load({ status: next })
              }}
              className={`max-w-[14rem] ${inputClass}`}
            >
              {statusFilters(c).map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <TableSkeleton cols={6} />
        ) : view === 'certifications' ? (
          certifications.length === 0 ? (
            <EmptyState
              icon={BadgeCheck}
              message={c.emptyCertifications}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                    <th className="px-3 py-3 font-semibold">{c.colEmployee}</th>
                    <th className="px-3 py-3 font-semibold">{c.colCertification}</th>
                    <th className="px-3 py-3 font-semibold">{c.colIssuingBody}</th>
                    <th className="px-3 py-3 font-semibold">{c.colIssued}</th>
                    <th className="px-3 py-3 font-semibold">{c.colExpires}</th>
                    <th className="px-3 py-3 font-semibold">{c.colStatus}</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {certifications.map((cert) => {
                    const state = certificationState(cert)
                    const days = daysUntilExpiry(cert)
                    return (
                      <tr key={cert.id} className="border-b border-ink-800 last:border-0">
                        <td className="px-3 py-3">
                          <Link
                            to={`/dashboard/hr/employees/${cert.employeeId}`}
                            className="font-medium text-ink-100 hover:text-cyan-accent"
                          >
                            {cert.employee.firstName} {cert.employee.lastName}
                          </Link>
                          <div className="font-mono text-xs text-ink-400">{cert.employee.employeeCode}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-ink-100">{cert.name}</div>
                          {cert.category && <div className="text-xs text-ink-400">{cert.category}</div>}
                        </td>
                        <td className="px-3 py-3 text-ink-300">{cert.issuingBody || '—'}</td>
                        <td className="px-3 py-3 text-ink-300">{formatDate(cert.issueDate, locale)}</td>
                        <td className="px-3 py-3 text-ink-300">
                          {formatDate(cert.expiryDate, locale)}
                          {days !== null && days >= 0 && days <= 60 && (
                            <div className="text-xs text-amber-400">{c.inDays(days)}</div>
                          )}
                          {days !== null && days < 0 && (
                            <div className="text-xs text-red-400">{c.daysAgo(Math.abs(days))}</div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={certificationStateTone[state]}>
                            {t.labels.certificationState[state]}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-3 text-ink-400">
                            <button
                              type="button"
                              onClick={() => openCertEdit(cert)}
                              aria-label={c.editCertAria}
                              className="hover:text-ink-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCertDelete(cert)}
                              aria-label={c.deleteCertAria}
                              className="hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : training.length === 0 ? (
          <EmptyState icon={GraduationCap} message={c.emptyTraining} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{c.colEmployee}</th>
                  <th className="px-3 py-3 font-semibold">{c.colTraining}</th>
                  <th className="px-3 py-3 font-semibold">{c.colProvider}</th>
                  <th className="px-3 py-3 font-semibold">{c.colCompleted}</th>
                  <th className="px-3 py-3 font-semibold">{c.colHours}</th>
                  <th className="px-3 py-3 font-semibold">{c.colCost}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {training.map((r) => (
                  <tr key={r.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/hr/employees/${r.employeeId}`}
                        className="font-medium text-ink-100 hover:text-cyan-accent"
                      >
                        {r.employee.firstName} {r.employee.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-100">{r.title}</td>
                    <td className="px-3 py-3 text-ink-300">{r.provider || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{formatDate(r.completedDate, locale)}</td>
                    <td className="px-3 py-3 text-ink-300">{r.durationHours || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{r.cost ? formatMoney(r.cost) : '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        <button
                          type="button"
                          onClick={() => openTrainingEdit(r)}
                          aria-label={c.editTrainingAria}
                          className="hover:text-ink-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTrainingDelete(r)}
                          aria-label={c.deleteTrainingAria}
                          className="hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showCertForm && (
        <Modal
          title={editingCert ? c.editCertification : c.addCertification}
          onClose={() => {
            setShowCertForm(false)
            setEditingCert(null)
          }}
        >
          <form onSubmit={handleCertSubmit} className="flex flex-col gap-4">
            {!editingCert && certDraft.restored && <DraftNotice onDiscard={() => setCertForm(certDraft.discard())} />}
            <div>
              <label className={labelClass}>{c.employee}</label>
              <select
                value={certForm.employeeId}
                onChange={(e) => setCertForm({ ...certForm, employeeId: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              >
                <option value="">{c.selectEmployee}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>{c.certName}</label>
              <input
                value={certForm.name}
                onChange={(e) => setCertForm({ ...certForm, name: e.target.value })}
                placeholder={c.certNamePlaceholder}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{c.category}</label>
                <input
                  value={certForm.category}
                  onChange={(e) => setCertForm({ ...certForm, category: e.target.value })}
                  placeholder={c.categoryPlaceholder}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{c.issuingBody}</label>
                <input
                  value={certForm.issuingBody}
                  onChange={(e) => setCertForm({ ...certForm, issuingBody: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{c.certNumber}</label>
                <input
                  value={certForm.certificateNumber}
                  onChange={(e) => setCertForm({ ...certForm, certificateNumber: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{c.issueDate}</label>
                <input
                  type="date"
                  value={certForm.issueDate}
                  onChange={(e) => setCertForm({ ...certForm, issueDate: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{c.expiryDate}</label>
                <input
                  type="date"
                  value={certForm.expiryDate}
                  onChange={(e) => setCertForm({ ...certForm, expiryDate: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>{c.notes}</label>
              <textarea
                value={certForm.notes}
                onChange={(e) => setCertForm({ ...certForm, notes: e.target.value })}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? c.saving : editingCert ? c.saveChanges : c.addCertification}
            </button>
          </form>
        </Modal>
      )}

      {showTrainingForm && (
        <Modal
          title={editingTraining ? c.editTraining : c.recordTraining}
          onClose={() => {
            setShowTrainingForm(false)
            setEditingTraining(null)
          }}
        >
          <form onSubmit={handleTrainingSubmit} className="flex flex-col gap-4">
            {!editingTraining && trainingDraft.restored && <DraftNotice onDiscard={() => setTrainingForm(trainingDraft.discard())} />}
            <div>
              <label className={labelClass}>{c.employee}</label>
              <select
                value={trainingForm.employeeId}
                onChange={(e) => setTrainingForm({ ...trainingForm, employeeId: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              >
                <option value="">{c.selectEmployee}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>{c.trainingTitle}</label>
              <input
                value={trainingForm.title}
                onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })}
                placeholder={c.trainingTitlePlaceholder}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{c.provider}</label>
                <input
                  value={trainingForm.provider}
                  onChange={(e) => setTrainingForm({ ...trainingForm, provider: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{c.completedOn}</label>
                <input
                  type="date"
                  value={trainingForm.completedDate}
                  onChange={(e) => setTrainingForm({ ...trainingForm, completedDate: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{c.duration}</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={trainingForm.durationHours}
                  onChange={(e) => setTrainingForm({ ...trainingForm, durationHours: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{c.cost}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={trainingForm.cost}
                  onChange={(e) => setTrainingForm({ ...trainingForm, cost: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>{c.notes}</label>
              <textarea
                value={trainingForm.notes}
                onChange={(e) => setTrainingForm({ ...trainingForm, notes: e.target.value })}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? c.saving : editingTraining ? c.saveChanges : c.recordTraining}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default CertificationsPage
