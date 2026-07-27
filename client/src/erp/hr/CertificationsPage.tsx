import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search, BadgeCheck, GraduationCap } from 'lucide-react'
import * as api from '../../lib/api'
import type { Certification, TrainingRecord } from '../../lib/api'
import { Panel, StatCard, Modal, Badge, EmptyState, TableSkeleton } from '../../dashboard/ui'
import { useToast } from '../../dashboard/ToastContext'
import { useConfirm } from '../../dashboard/ConfirmContext'
import { useEmployees } from '../useEmployees'
import { formatMoney } from '../../lib/format'
import { inputClass, labelClass, primaryButtonClass } from './formStyles'
import {
  certificationState,
  certificationStateLabel,
  certificationStateTone,
  daysUntilExpiry,
} from './certificationStatus'

type View = 'certifications' | 'training'

const STATUS_FILTERS: { value: '' | 'valid' | 'expiring' | 'expired'; label: string }[] = [
  { value: '', label: 'All certifications' },
  { value: 'expiring', label: 'Renew soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'valid', label: 'Valid' },
]

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
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

  const [trainingForm, setTrainingForm] = useState<TrainingFormState>(EMPTY_TRAINING)
  const [editingTraining, setEditingTraining] = useState<TrainingRecord | null>(null)
  const [showTrainingForm, setShowTrainingForm] = useState(false)

  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    (overrides: { search?: string; status?: typeof status; employeeId?: string } = {}) => {
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
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load records'))
        .finally(() => setLoading(false))
    },
    [search, status, employeeId],
  )

  useEffect(() => {
    load({ search: '', status: '', employeeId: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------------- certifications ---------------- */

  function openCertCreate() {
    setCertForm(EMPTY_CERT)
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

    if (!certForm.employeeId) return setFormError('Select an employee')
    if (!certForm.name.trim()) return setFormError('Certification name is required')

    setSubmitting(true)
    try {
      if (editingCert) {
        await api.updateCertification(editingCert.id, certForm)
      } else {
        await api.createCertification(certForm)
      }
      toast.success(editingCert ? 'Certification updated' : 'Certification added')
      setShowCertForm(false)
      setEditingCert(null)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save certification')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCertDelete(certification: Certification) {
    const ok = await confirm({
      title: 'Delete certification',
      message: `Delete "${certification.name}" for ${certification.employee.firstName} ${certification.employee.lastName}?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteCertification(certification.id)
      toast.success('Certification deleted')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete certification')
    }
  }

  /* ---------------- training ---------------- */

  function openTrainingCreate() {
    setTrainingForm(EMPTY_TRAINING)
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

    if (!trainingForm.employeeId) return setFormError('Select an employee')
    if (!trainingForm.title.trim()) return setFormError('Training title is required')

    setSubmitting(true)
    try {
      if (editingTraining) {
        await api.updateTrainingRecord(editingTraining.id, trainingForm)
      } else {
        await api.createTrainingRecord(trainingForm)
      }
      toast.success(editingTraining ? 'Training record updated' : 'Training recorded')
      setShowTrainingForm(false)
      setEditingTraining(null)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save training record')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTrainingDelete(record: TrainingRecord) {
    const ok = await confirm({
      title: 'Delete training record',
      message: `Delete "${record.title}"?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteTrainingRecord(record.id)
      toast.success('Training record deleted')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete training record')
    }
  }

  const expiredCount = certifications.filter((c) => certificationState(c) === 'EXPIRED').length
  const expiringCount = certifications.filter((c) => certificationState(c) === 'EXPIRING').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'certifications', label: 'Certifications' },
            { key: 'training', label: 'Training' },
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
          className="ml-auto flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark"
        >
          <Plus className="h-4 w-4" />
          {view === 'certifications' ? 'Add Certification' : 'Record Training'}
        </button>
      </div>

      {view === 'certifications' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="CERTIFICATIONS" value={certifications.length} />
          <StatCard label="RENEW SOON" value={expiringCount} deltaTone="warning" />
          <StatCard label="EXPIRED" value={expiredCount} />
        </div>
      )}

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-md border border-ink-700 bg-ink-950 px-3 py-2">
            <Search className="h-4 w-4 text-ink-400" />
            <input
              type="text"
              placeholder={
                view === 'certifications' ? 'Search name, body, or number...' : 'Search title or provider...'
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
            <option value="">All employees</option>
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
              {STATUS_FILTERS.map((f) => (
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
              message="No certifications recorded. Track safety and trade licences here so renewals never lapse."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                    <th className="px-3 py-3 font-semibold">EMPLOYEE</th>
                    <th className="px-3 py-3 font-semibold">CERTIFICATION</th>
                    <th className="px-3 py-3 font-semibold">ISSUING BODY</th>
                    <th className="px-3 py-3 font-semibold">ISSUED</th>
                    <th className="px-3 py-3 font-semibold">EXPIRES</th>
                    <th className="px-3 py-3 font-semibold">STATUS</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {certifications.map((c) => {
                    const state = certificationState(c)
                    const days = daysUntilExpiry(c)
                    return (
                      <tr key={c.id} className="border-b border-ink-800 last:border-0">
                        <td className="px-3 py-3">
                          <Link
                            to={`/dashboard/erp/hr/employees/${c.employeeId}`}
                            className="font-medium text-ink-100 hover:text-cyan-accent"
                          >
                            {c.employee.firstName} {c.employee.lastName}
                          </Link>
                          <div className="text-xs text-ink-400">{c.employee.employeeCode}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-ink-100">{c.name}</div>
                          {c.category && <div className="text-xs text-ink-400">{c.category}</div>}
                        </td>
                        <td className="px-3 py-3 text-ink-300">{c.issuingBody || '—'}</td>
                        <td className="px-3 py-3 text-ink-300">{formatDate(c.issueDate)}</td>
                        <td className="px-3 py-3 text-ink-300">
                          {formatDate(c.expiryDate)}
                          {days !== null && days >= 0 && days <= 60 && (
                            <div className="text-xs text-amber-400">in {days} days</div>
                          )}
                          {days !== null && days < 0 && (
                            <div className="text-xs text-red-400">{Math.abs(days)} days ago</div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={certificationStateTone[state]}>
                            {certificationStateLabel[state]}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-3 text-ink-400">
                            <button
                              type="button"
                              onClick={() => openCertEdit(c)}
                              aria-label="Edit certification"
                              className="hover:text-ink-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCertDelete(c)}
                              aria-label="Delete certification"
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
          <EmptyState icon={GraduationCap} message="No training recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">EMPLOYEE</th>
                  <th className="px-3 py-3 font-semibold">TRAINING</th>
                  <th className="px-3 py-3 font-semibold">PROVIDER</th>
                  <th className="px-3 py-3 font-semibold">COMPLETED</th>
                  <th className="px-3 py-3 font-semibold">HOURS</th>
                  <th className="px-3 py-3 font-semibold">COST</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {training.map((t) => (
                  <tr key={t.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        to={`/dashboard/erp/hr/employees/${t.employeeId}`}
                        className="font-medium text-ink-100 hover:text-cyan-accent"
                      >
                        {t.employee.firstName} {t.employee.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-100">{t.title}</td>
                    <td className="px-3 py-3 text-ink-300">{t.provider || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{formatDate(t.completedDate)}</td>
                    <td className="px-3 py-3 text-ink-300">{t.durationHours || '—'}</td>
                    <td className="px-3 py-3 text-ink-300">{t.cost ? formatMoney(t.cost) : '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        <button
                          type="button"
                          onClick={() => openTrainingEdit(t)}
                          aria-label="Edit training record"
                          className="hover:text-ink-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTrainingDelete(t)}
                          aria-label="Delete training record"
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
          title={editingCert ? 'Edit Certification' : 'Add Certification'}
          onClose={() => {
            setShowCertForm(false)
            setEditingCert(null)
          }}
        >
          <form onSubmit={handleCertSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>EMPLOYEE</label>
              <select
                value={certForm.employeeId}
                onChange={(e) => setCertForm({ ...certForm, employeeId: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              >
                <option value="">Select an employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>CERTIFICATION NAME</label>
              <input
                value={certForm.name}
                onChange={(e) => setCertForm({ ...certForm, name: e.target.value })}
                placeholder="e.g. Working at Height"
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CATEGORY</label>
                <input
                  value={certForm.category}
                  onChange={(e) => setCertForm({ ...certForm, category: e.target.value })}
                  placeholder="e.g. Safety"
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>ISSUING BODY</label>
                <input
                  value={certForm.issuingBody}
                  onChange={(e) => setCertForm({ ...certForm, issuingBody: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>CERTIFICATE NUMBER</label>
                <input
                  value={certForm.certificateNumber}
                  onChange={(e) => setCertForm({ ...certForm, certificateNumber: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>ISSUE DATE</label>
                <input
                  type="date"
                  value={certForm.issueDate}
                  onChange={(e) => setCertForm({ ...certForm, issueDate: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>EXPIRY DATE</label>
                <input
                  type="date"
                  value={certForm.expiryDate}
                  onChange={(e) => setCertForm({ ...certForm, expiryDate: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>NOTES</label>
              <textarea
                value={certForm.notes}
                onChange={(e) => setCertForm({ ...certForm, notes: e.target.value })}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={primaryButtonClass}>
              {submitting ? 'Saving…' : editingCert ? 'Save Changes' : 'Add Certification'}
            </button>
          </form>
        </Modal>
      )}

      {showTrainingForm && (
        <Modal
          title={editingTraining ? 'Edit Training Record' : 'Record Training'}
          onClose={() => {
            setShowTrainingForm(false)
            setEditingTraining(null)
          }}
        >
          <form onSubmit={handleTrainingSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>EMPLOYEE</label>
              <select
                value={trainingForm.employeeId}
                onChange={(e) => setTrainingForm({ ...trainingForm, employeeId: e.target.value })}
                required
                className={`mt-2 ${inputClass}`}
              >
                <option value="">Select an employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>TRAINING TITLE</label>
              <input
                value={trainingForm.title}
                onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })}
                placeholder="e.g. Electrical Safety Refresher"
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>PROVIDER</label>
                <input
                  value={trainingForm.provider}
                  onChange={(e) => setTrainingForm({ ...trainingForm, provider: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>COMPLETED ON</label>
                <input
                  type="date"
                  value={trainingForm.completedDate}
                  onChange={(e) => setTrainingForm({ ...trainingForm, completedDate: e.target.value })}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>DURATION (HOURS)</label>
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
                <label className={labelClass}>COST (MUR)</label>
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
              <label className={labelClass}>NOTES</label>
              <textarea
                value={trainingForm.notes}
                onChange={(e) => setTrainingForm({ ...trainingForm, notes: e.target.value })}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={primaryButtonClass}>
              {submitting ? 'Saving…' : editingTraining ? 'Save Changes' : 'Record Training'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default CertificationsPage
