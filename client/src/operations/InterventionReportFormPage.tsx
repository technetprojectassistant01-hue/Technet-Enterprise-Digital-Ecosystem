import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Paperclip, X as XIcon, ImagePlus, Lock } from 'lucide-react'
import type { InterventionReport, JobCategory, WarrantyStatus } from '../lib/api'
import { JOB_CATEGORY_LABELS, WORK_TYPE_LABELS } from '../lib/api'
import type { ServiceCategory } from '../lib/api'
import { submitOrQueue } from '../lib/outbox'
import { EmptyState, Panel } from '../dashboard/ui'
import { primaryButtonClass, secondaryButtonClass } from '../dashboard/buttonStyles'
import { useToast } from '../dashboard/ToastContext'
import { useAuth } from '../context/AuthContext'
import { hasRole, OPS_SUBMIT_ROLES } from '../lib/permissions'
import { useAssignableEmployees } from '../erp/useEmployees'
import { useCustomers } from '../erp/useCustomers'
import { useWorkOrders } from './useWorkOrders'
import SignaturePad from './SignaturePad'
import UnitBreakdownEditor, { type UnitBreakdownRow } from './UnitBreakdownEditor'
import { enumLabel, useT } from '../i18n'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const JOB_CATEGORIES = Object.keys(JOB_CATEGORY_LABELS) as JobCategory[]
const WORK_TYPES = Object.keys(WORK_TYPE_LABELS) as ServiceCategory[]
const WARRANTY_OPTIONS: WarrantyStatus[] = ['YES', 'NO', 'UNKNOWN']
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
const DRAFT_STORAGE_KEY = 'intervention-report-draft'

function RequiredMark() {
  return (
    <span className="text-red-400" aria-hidden="true">
      {' '}
      *
    </span>
  )
}

interface DraftFields {
  customerId: string
  workOrderId: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  jobCategory: JobCategory
  workType: ServiceCategory
  workTypeOther: string
  equipment: string
  make: string
  model: string
  serialNo: string
  natureOfIntervention: string
  actionTaken: string
  workCompleted: boolean
  incompleteDetails: string
  units: UnitBreakdownRow[]
  technicianIds: string[]
  timeIn: string
  timeOut: string
  warrantyStatus: WarrantyStatus | ''
  technicianReport: string
  materialsUsed: string
  comments: string
  additionalInfo: string
  signedByName: string
}

function loadDraft(): DraftFields | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DraftFields) : null
  } catch {
    return null
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function PhotoPicker({
  label,
  files,
  onChange,
}: {
  label: string
  files: File[]
  onChange: (files: File[]) => void
}) {
  const t = useT()

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []).filter((f) => f.size <= MAX_ATTACHMENT_BYTES)
    onChange([...files, ...selected])
    e.target.value = ''
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="mt-2 flex items-center gap-3 rounded-md border border-dashed border-ink-600 bg-ink-950 px-4 py-3">
        <ImagePlus className="h-4 w-4 shrink-0 text-ink-400" />
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleSelect}
          className="w-full text-sm text-ink-300 file:mr-3 file:rounded file:border-0 file:bg-ink-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-200"
        />
      </div>
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5 rounded-full bg-ink-800 px-3 py-1 text-xs text-ink-200">
              {f.name}
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={t.ops.irForm.remove(f.name)}
                className="text-ink-400 hover:text-red-400"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-ink-500">{t.ops.irForm.imagesOnly}</p>
    </div>
  )
}

function InterventionReportFormPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const t = useT()
  const { user } = useAuth()
  const canSubmit = hasRole(user?.role, OPS_SUBMIT_ROLES)
  const [searchParams] = useSearchParams()
  const preselectedWorkOrderId = searchParams.get('workOrderId') || ''

  const customers = useCustomers()
  const workOrders = useWorkOrders()
  const employees = useAssignableEmployees()

  const [draft] = useState(() => loadDraft())
  const [draftRestored, setDraftRestored] = useState(() => draft !== null)

  const [customerId, setCustomerId] = useState(draft?.customerId ?? '')
  const [workOrderId, setWorkOrderId] = useState(draft?.workOrderId || preselectedWorkOrderId)
  const [contactPerson, setContactPerson] = useState(draft?.contactPerson ?? '')
  const [contactPhone, setContactPhone] = useState(draft?.contactPhone ?? '')
  const [contactEmail, setContactEmail] = useState(draft?.contactEmail ?? '')
  const [jobCategory, setJobCategory] = useState<JobCategory>(draft?.jobCategory ?? 'SERVICING')
  const [workType, setWorkType] = useState<ServiceCategory>(draft?.workType ?? 'ELECTRICAL')
  const [workTypeOther, setWorkTypeOther] = useState(draft?.workTypeOther ?? '')

  const [equipment, setEquipment] = useState(draft?.equipment ?? '')
  const [make, setMake] = useState(draft?.make ?? '')
  const [model, setModel] = useState(draft?.model ?? '')
  const [serialNo, setSerialNo] = useState(draft?.serialNo ?? '')

  const [natureOfIntervention, setNatureOfIntervention] = useState(draft?.natureOfIntervention ?? '')
  const [actionTaken, setActionTaken] = useState(draft?.actionTaken ?? '')
  const [workCompleted, setWorkCompleted] = useState(draft?.workCompleted ?? true)
  const [incompleteDetails, setIncompleteDetails] = useState(draft?.incompleteDetails ?? '')
  const [units, setUnits] = useState<UnitBreakdownRow[]>(draft?.units ?? [])

  const [technicianIds, setTechnicianIds] = useState<string[]>(draft?.technicianIds ?? [])
  const [timeIn, setTimeIn] = useState(draft?.timeIn ?? '')
  const [timeOut, setTimeOut] = useState(draft?.timeOut ?? '')

  const [warrantyStatus, setWarrantyStatus] = useState<WarrantyStatus | ''>(draft?.warrantyStatus ?? '')
  const [technicianReport, setTechnicianReport] = useState(draft?.technicianReport ?? '')
  const [materialsUsed, setMaterialsUsed] = useState(draft?.materialsUsed ?? '')
  const [comments, setComments] = useState(draft?.comments ?? '')
  const [additionalInfo, setAdditionalInfo] = useState(draft?.additionalInfo ?? '')

  const [beforePhotos, setBeforePhotos] = useState<File[]>([])
  const [afterPhotos, setAfterPhotos] = useState<File[]>([])
  const [equipmentPhotos, setEquipmentPhotos] = useState<File[]>([])
  const [workDonePhotos, setWorkDonePhotos] = useState<File[]>([])

  const [signedByName, setSignedByName] = useState(draft?.signedByName ?? '')
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fields: DraftFields = {
      customerId,
      workOrderId,
      contactPerson,
      contactPhone,
      contactEmail,
      jobCategory,
      workType,
      workTypeOther,
      equipment,
      make,
      model,
      serialNo,
      natureOfIntervention,
      actionTaken,
      workCompleted,
      incompleteDetails,
      units,
      technicianIds,
      timeIn,
      timeOut,
      warrantyStatus,
      technicianReport,
      materialsUsed,
      comments,
      additionalInfo,
      signedByName,
    }
    const hasContent = Object.values(fields).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v) && v !== true))
    const timeout = setTimeout(() => {
      if (hasContent) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(fields))
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY)
      }
    }, 400)
    return () => clearTimeout(timeout)
  }, [
    customerId,
    workOrderId,
    contactPerson,
    contactPhone,
    contactEmail,
    jobCategory,
    workType,
    workTypeOther,
    equipment,
    make,
    model,
    serialNo,
    natureOfIntervention,
    actionTaken,
    workCompleted,
    incompleteDetails,
    units,
    technicianIds,
    timeIn,
    timeOut,
    warrantyStatus,
    technicianReport,
    materialsUsed,
    comments,
    additionalInfo,
    signedByName,
  ])

  function discardDraft() {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
    setDraftRestored(false)
    setCustomerId('')
    setWorkOrderId(preselectedWorkOrderId)
    setContactPerson('')
    setContactPhone('')
    setContactEmail('')
    setJobCategory('SERVICING')
    setWorkType('ELECTRICAL')
    setWorkTypeOther('')
    setEquipment('')
    setMake('')
    setModel('')
    setSerialNo('')
    setNatureOfIntervention('')
    setActionTaken('')
    setWorkCompleted(true)
    setIncompleteDetails('')
    setUnits([])
    setTechnicianIds([])
    setTimeIn('')
    setTimeOut('')
    setWarrantyStatus('')
    setTechnicianReport('')
    setMaterialsUsed('')
    setComments('')
    setAdditionalInfo('')
    setSignedByName('')
  }

  useEffect(() => {
    if (!preselectedWorkOrderId) return
    const wo = workOrders.find((w) => w.id === preselectedWorkOrderId)
    if (wo) {
      setJobCategory(wo.jobCategory)
      setCustomerId((prev) => prev || wo.customerId)
    }
  }, [preselectedWorkOrderId, workOrders])

  function toggleTechnician(id: string) {
    setTechnicianIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAttachmentError(null)
    const file = e.target.files?.[0] || null
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError(t.ops.irForm.fileTooLarge)
      setAttachmentFile(null)
      e.target.value = ''
      return
    }
    setAttachmentFile(file)
  }

  const customerName =
    customers.find((c) => c.id === customerId)?.company ||
    customers.find((c) => c.id === customerId)?.name ||
    ''

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!customerId) {
      setFormError(t.shared.selectCustomer)
      return
    }
    if (!natureOfIntervention.trim()) {
      setFormError(t.ops.irForm.natureRequired)
      return
    }
    if (!actionTaken.trim()) {
      setFormError(t.ops.irForm.actionRequired)
      return
    }
    if (!signatureData) {
      setFormError(t.ops.irForm.signRequired)
      return
    }
    if (!signedByName.trim()) {
      setFormError(t.ops.irForm.signerRequired)
      return
    }
    const cleanedUnits = units
      .filter((u) => u.label.trim() || u.problem.trim() || u.action.trim())
      .map((u) => ({ label: u.label.trim(), problem: u.problem.trim(), action: u.action.trim() }))
    for (const u of cleanedUnits) {
      if (!u.label || !u.problem) {
        setFormError(t.ops.irForm.unitIncomplete)
        return
      }
    }

    setSubmitting(true)
    try {
      let attachmentData: string | undefined
      if (attachmentFile) {
        attachmentData = await readFileAsDataUrl(attachmentFile)
      }

      // Turn every photo into a data URL up front, so the whole report — text, signature,
      // attachment and photos — can be handed to the outbox as one unit and saved on the device
      // if there's no signal (see lib/outbox). Online, the outbox sends it straight through.
      const photoFiles = [
        ...beforePhotos.map((f) => ({ file: f, kind: 'BEFORE' as const })),
        ...afterPhotos.map((f) => ({ file: f, kind: 'AFTER' as const })),
        ...equipmentPhotos.map((f) => ({ file: f, kind: 'EQUIPMENT' as const })),
        ...workDonePhotos.map((f) => ({ file: f, kind: 'WORK_DONE' as const })),
      ]
      const photos = await Promise.all(
        photoFiles.map(async ({ file, kind }) => ({
          kind,
          fileData: await readFileAsDataUrl(file),
          fileName: file.name,
        })),
      )

      const { queued, data } = await submitOrQueue<{ interventionReport: InterventionReport }>({
        kind: 'intervention-report',
        label: t.ops.irForm.outboxLabel(customerName || t.ops.irForm.customerFallback),
        endpoint: '/api/intervention-reports',
        body: {
          customerId,
          workOrderId: workOrderId || undefined,
          contactPerson: contactPerson || undefined,
          contactPhone: contactPhone || undefined,
          contactEmail: contactEmail || undefined,
          jobCategory,
          workType,
          workTypeOther: workType === 'OTHER' ? workTypeOther || undefined : undefined,
          equipment: equipment || undefined,
          make: make || undefined,
          model: model || undefined,
          serialNo: serialNo || undefined,
          natureOfIntervention,
          actionTaken,
          workCompleted,
          incompleteDetails: workCompleted ? undefined : incompleteDetails || undefined,
          timeIn: timeIn || undefined,
          timeOut: timeOut || undefined,
          warrantyStatus: warrantyStatus || undefined,
          technicianReport: technicianReport || undefined,
          materialsUsed: materialsUsed || undefined,
          comments: comments || undefined,
          additionalInfo: additionalInfo || undefined,
          technicianIds,
          units: cleanedUnits.length > 0 ? cleanedUnits : undefined,
          signedByName,
          signatureData,
          attachmentData,
          attachmentFileName: attachmentFile?.name,
        },
        photos,
      })

      localStorage.removeItem(DRAFT_STORAGE_KEY)
      if (queued || !data?.interventionReport) {
        toast.success(t.shared.savedOffline)
        navigate('/dashboard/operations/intervention-reports')
      } else {
        toast.success(t.ops.irForm.submitted)
        navigate(`/dashboard/operations/intervention-reports/${data.interventionReport.id}`)
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.ops.irForm.submitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  if (!canSubmit) {
    return <EmptyState icon={Lock} message={t.ops.irForm.noPermission} />
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/operations/intervention-reports"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.ops.irForm.back}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-ink-100">{t.ops.irForm.title}</h1>
        <p className="mt-1 text-sm text-ink-300">{t.ops.irForm.subtitle}</p>
        <p className="mt-1 text-xs text-ink-500">
          <span className="text-red-400">*</span> {t.ops.irForm.requiredField}
        </p>
      </div>

      {draftRestored && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-cyan-accent/40 bg-cyan-accent/10 px-4 py-3 text-sm text-ink-200">
          <p>{t.ops.irForm.draftRestored}</p>
          <button type="button" onClick={discardDraft} className={`shrink-0 ${secondaryButtonClass}`}>
            {t.ops.irForm.discardDraft}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Panel title={t.ops.irForm.customerContact}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t.shared.customer}
                  <RequiredMark />
                </label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">{t.shared.selectCustomer}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.ops.irForm.workOrderOptional}</label>
                <select value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">{t.ops.irForm.linkLater}</option>
                  {workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.workOrderNumber} — {wo.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-ink-500">{t.ops.irForm.autoNumber}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>{t.ops.irForm.contactPerson}</label>
                <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>{t.ops.irForm.contactPhone}</label>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder={t.ops.irForm.phonePlaceholder}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{t.ops.irForm.contactEmail}</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder={t.ops.irForm.emailPlaceholder}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.shared.jobCategory}</label>
                <select
                  value={jobCategory}
                  onChange={(e) => setJobCategory(e.target.value as JobCategory)}
                  className={`mt-2 ${inputClass}`}
                >
                  {JOB_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {enumLabel(t.labels.jobCategory, c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.shared.workType}</label>
                <select
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value as ServiceCategory)}
                  className={`mt-2 ${inputClass}`}
                >
                  {WORK_TYPES.map((w) => (
                    <option key={w} value={w}>
                      {enumLabel(t.labels.workType, w)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {workType === 'OTHER' && (
              <div>
                <label className={labelClass}>{t.ops.irForm.describeWork}</label>
                <input
                  value={workTypeOther}
                  onChange={(e) => setWorkTypeOther(e.target.value)}
                  placeholder={t.ops.irForm.describePlaceholder}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            )}
          </div>
        </Panel>

        <Panel title={t.ops.irForm.equipmentPanel}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.ops.irForm.equipment}</label>
                <input value={equipment} onChange={(e) => setEquipment(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>{t.ops.irForm.make}</label>
                <input value={make} onChange={(e) => setMake(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>{t.ops.irForm.model}</label>
                <input value={model} onChange={(e) => setModel(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>{t.ops.irForm.serialNumbers}</label>
                <input
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  placeholder={t.ops.irForm.serialsPlaceholder}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>
            <PhotoPicker label={t.ops.irForm.equipmentPhotos} files={equipmentPhotos} onChange={setEquipmentPhotos} />
          </div>
        </Panel>

        <Panel title={t.ops.irForm.faultPanel}>
          <div className="flex flex-col gap-4">
            <PhotoPicker label={t.ops.irForm.beforePhotos} files={beforePhotos} onChange={setBeforePhotos} />
            <div>
              <label className={labelClass}>
                {t.ops.irForm.nature}
                <RequiredMark />
              </label>
              <textarea
                value={natureOfIntervention}
                onChange={(e) => setNatureOfIntervention(e.target.value)}
                rows={2}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t.ops.irForm.action}
                <RequiredMark />
              </label>
              <textarea
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                rows={3}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{t.shared.workCompletedQuestion}</label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-ink-200">
                  <input type="radio" checked={workCompleted} onChange={() => setWorkCompleted(true)} className="accent-cyan-accent" />
                  {t.shared.yes}
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-200">
                  <input type="radio" checked={!workCompleted} onChange={() => setWorkCompleted(false)} className="accent-cyan-accent" />
                  {t.shared.no}
                </label>
              </div>
            </div>
            {!workCompleted && (
              <div>
                <label className={labelClass}>{t.ops.irForm.giveDetails}</label>
                <textarea
                  value={incompleteDetails}
                  onChange={(e) => setIncompleteDetails(e.target.value)}
                  rows={2}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            )}
            <div>
              <label className={labelClass}>{t.ops.irForm.perUnit}</label>
              <p className="mt-1 text-xs text-ink-500">{t.ops.irForm.perUnitHint}</p>
              <div className="mt-2">
                <UnitBreakdownEditor units={units} onChange={setUnits} />
              </div>
            </div>
            <PhotoPicker label={t.ops.irForm.workDonePhotos} files={workDonePhotos} onChange={setWorkDonePhotos} />
            <PhotoPicker label={t.ops.irForm.afterPhotos} files={afterPhotos} onChange={setAfterPhotos} />
            <div>
              <label className={labelClass}>{t.ops.irForm.materials}</label>
              <textarea
                value={materialsUsed}
                onChange={(e) => setMaterialsUsed(e.target.value)}
                rows={2}
                placeholder={t.ops.irForm.materialsPlaceholder}
                className={`mt-2 ${inputClass}`}
              />
            </div>
          </div>
        </Panel>

        <Panel title={t.ops.irForm.techTimePanel}>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.ops.irForm.techniciansInvolved}</label>
              <div className="mt-2 flex max-h-32 flex-col gap-1.5 overflow-y-auto rounded-md border border-ink-700 bg-ink-950 p-3">
                {employees.length === 0 ? (
                  <p className="text-xs text-ink-500">{t.shared.noEmployees}</p>
                ) : (
                  employees.map((emp) => (
                    <label key={emp.id} className="flex items-center gap-2 text-sm text-ink-200">
                      <input
                        type="checkbox"
                        checked={technicianIds.includes(emp.id)}
                        onChange={() => toggleTechnician(emp.id)}
                        className="accent-cyan-accent"
                      />
                      {emp.firstName} {emp.lastName}
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.attendance.timeIn}</label>
                <input type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>{t.attendance.timeOut}</label>
                <input type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={t.ops.irForm.warrantyPanel}>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.ops.irForm.underWarranty}</label>
              <div className="mt-2 flex gap-4">
                {WARRANTY_OPTIONS.map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-ink-200">
                    <input
                      type="radio"
                      checked={warrantyStatus === value}
                      onChange={() => setWarrantyStatus(value)}
                      className="accent-cyan-accent"
                    />
                    {enumLabel(t.labels.warranty, value)}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>{t.ops.irForm.technicianReport}</label>
              <textarea
                value={technicianReport}
                onChange={(e) => setTechnicianReport(e.target.value)}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{t.ops.irForm.comments}</label>
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className={`mt-2 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>{t.ops.irForm.otherInfo}</label>
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={2}
                placeholder={t.ops.irForm.otherInfoPlaceholder}
                className={`mt-2 ${inputClass}`}
              />
            </div>
          </div>
        </Panel>

        <Panel title={t.ops.irForm.signPanel}>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>
                {t.ops.irForm.signedBy}
                <RequiredMark />
              </label>
              <input
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                placeholder={t.ops.irForm.yourName}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>
                {t.ops.irForm.signature}
                <RequiredMark />
              </label>
              <div className="mt-2">
                <SignaturePad onChange={setSignatureData} />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t.ops.irForm.uploadSheet}</label>
              <div className="mt-2 flex items-center gap-3 rounded-md border border-dashed border-ink-600 bg-ink-950 px-4 py-3">
                <Paperclip className="h-4 w-4 shrink-0 text-ink-400" />
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="w-full text-sm text-ink-300 file:mr-3 file:rounded file:border-0 file:bg-ink-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-200"
                />
              </div>
              {attachmentFile && <p className="mt-1 text-xs text-ink-400">{attachmentFile.name}</p>}
              {attachmentError && <p className="mt-1 text-xs text-red-400">{attachmentError}</p>}
              <p className="mt-1 text-xs text-ink-500">{t.ops.irForm.sheetHint}</p>
            </div>
          </div>
        </Panel>

        {formError && <p className="text-sm text-red-400">{formError}</p>}

        <button type="submit" disabled={submitting} className={`self-start px-6 py-2.5 ${primaryButtonClass}`}>
          {submitting ? t.shared.submitting : t.shared.submitReport}
        </button>
      </form>
    </div>
  )
}

export default InterventionReportFormPage
