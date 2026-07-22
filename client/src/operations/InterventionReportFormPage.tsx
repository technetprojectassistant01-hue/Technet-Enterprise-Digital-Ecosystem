import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Paperclip, X as XIcon, ImagePlus } from 'lucide-react'
import * as api from '../lib/api'
import type { JobCategory, WarrantyStatus } from '../lib/api'
import { JOB_CATEGORY_LABELS, WORK_TYPE_LABELS } from '../lib/api'
import type { ServiceCategory } from '../lib/api'
import { Panel } from '../dashboard/ui'
import { useToast } from '../dashboard/ToastContext'
import { useEmployees } from '../erp/useEmployees'
import { useCustomers } from '../erp/useCustomers'
import { useWorkOrders } from './useWorkOrders'
import SignaturePad from './SignaturePad'

const inputClass =
  'w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-ink-100 outline-none focus:border-cyan-accent'
const labelClass = 'text-xs font-semibold tracking-widest text-ink-400'

const JOB_CATEGORIES = Object.keys(JOB_CATEGORY_LABELS) as JobCategory[]
const WORK_TYPES = Object.keys(WORK_TYPE_LABELS) as ServiceCategory[]
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

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
              <button type="button" onClick={() => removeAt(i)} aria-label={`Remove ${f.name}`} className="text-ink-400 hover:text-red-400">
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-ink-500">Images only. Max 8MB each.</p>
    </div>
  )
}

function InterventionReportFormPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedWorkOrderId = searchParams.get('workOrderId') || ''

  const customers = useCustomers()
  const workOrders = useWorkOrders()
  const employees = useEmployees()

  const [customerId, setCustomerId] = useState('')
  const [workOrderId, setWorkOrderId] = useState(preselectedWorkOrderId)
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [jobCategory, setJobCategory] = useState<JobCategory>('SERVICING')
  const [workType, setWorkType] = useState<ServiceCategory>('ELECTRICAL')

  const [equipment, setEquipment] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [serialNo, setSerialNo] = useState('')

  const [natureOfIntervention, setNatureOfIntervention] = useState('')
  const [actionTaken, setActionTaken] = useState('')
  const [workCompleted, setWorkCompleted] = useState(true)
  const [incompleteDetails, setIncompleteDetails] = useState('')

  const [technicianIds, setTechnicianIds] = useState<string[]>([])
  const [timeIn, setTimeIn] = useState('')
  const [timeOut, setTimeOut] = useState('')

  const [warrantyStatus, setWarrantyStatus] = useState<WarrantyStatus | ''>('')
  const [technicianReport, setTechnicianReport] = useState('')
  const [comments, setComments] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')

  const [equipmentPhotos, setEquipmentPhotos] = useState<File[]>([])
  const [workDonePhotos, setWorkDonePhotos] = useState<File[]>([])

  const [signedByName, setSignedByName] = useState('')
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!preselectedWorkOrderId) return
    const wo = workOrders.find((w) => w.id === preselectedWorkOrderId)
    if (wo) {
      setJobCategory(wo.jobCategory)
      setCustomerId((prev) => prev || wo.customerId)
    }
  }, [preselectedWorkOrderId, workOrders])

  function toggleTechnician(id: string) {
    setTechnicianIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAttachmentError(null)
    const file = e.target.files?.[0] || null
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError('File must be 8MB or smaller')
      setAttachmentFile(null)
      e.target.value = ''
      return
    }
    setAttachmentFile(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!customerId) {
      setFormError('Select a customer')
      return
    }
    if (!natureOfIntervention.trim()) {
      setFormError('Nature of intervention is required')
      return
    }
    if (!actionTaken.trim()) {
      setFormError('Action taken is required')
      return
    }
    if (!signatureData) {
      setFormError('Sign the report before submitting')
      return
    }
    if (!signedByName.trim()) {
      setFormError('Enter the name of the person signing')
      return
    }

    setSubmitting(true)
    try {
      let attachmentData: string | undefined
      if (attachmentFile) {
        attachmentData = await readFileAsDataUrl(attachmentFile)
      }

      const { interventionReport } = await api.createInterventionReport({
        customerId,
        workOrderId: workOrderId || undefined,
        contactPerson: contactPerson || undefined,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        jobCategory,
        workType,
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
        comments: comments || undefined,
        additionalInfo: additionalInfo || undefined,
        technicianIds,
        signedByName,
        signatureData,
        attachmentData,
        attachmentFileName: attachmentFile?.name,
      })

      const photoUploads = [
        ...equipmentPhotos.map((f) => ({ file: f, kind: 'EQUIPMENT' as const })),
        ...workDonePhotos.map((f) => ({ file: f, kind: 'WORK_DONE' as const })),
      ]
      for (const { file, kind } of photoUploads) {
        const fileData = await readFileAsDataUrl(file)
        await api.uploadInterventionReportPhoto(interventionReport.id, { kind, fileData, fileName: file.name })
      }

      toast.success('Intervention report submitted')
      navigate(`/dashboard/operations/intervention-reports/${interventionReport.id}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit intervention report')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/dashboard/operations/intervention-reports"
        className="flex w-fit items-center gap-2 text-sm text-ink-400 hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Intervention Reports
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-ink-100">New Intervention Report</h1>
        <p className="mt-1 text-sm text-ink-300">Fill this in right after the site visit.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Panel title="Customer & Contact">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CUSTOMER</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>WORK ORDER (OPTIONAL)</label>
                <select value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)} className={`mt-2 ${inputClass}`}>
                  <option value="">— link now, or add later —</option>
                  {workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.workOrderNumber} — {wo.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-ink-500">The intervention number is assigned automatically on submit.</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>CONTACT PERSON</label>
                <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>CONTACT PHONE</label>
                <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>CONTACT EMAIL</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>JOB CATEGORY</label>
                <select
                  value={jobCategory}
                  onChange={(e) => setJobCategory(e.target.value as JobCategory)}
                  className={`mt-2 ${inputClass}`}
                >
                  {JOB_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {JOB_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>WORK TYPE</label>
                <select
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value as ServiceCategory)}
                  className={`mt-2 ${inputClass}`}
                >
                  {WORK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {WORK_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Equipment / System (optional)">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>EQUIPMENT</label>
                <input value={equipment} onChange={(e) => setEquipment(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>MAKE</label>
                <input value={make} onChange={(e) => setMake(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>MODEL</label>
                <input value={model} onChange={(e) => setModel(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>SERIAL NUMBER(S)</label>
                <input
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  placeholder="Comma-separated if multiple"
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>
            <PhotoPicker label="EQUIPMENT PHOTOS" files={equipmentPhotos} onChange={setEquipmentPhotos} />
          </div>
        </Panel>

        <Panel title="Fault & Work Done">
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>NATURE OF INTERVENTION / FAULT REPORTED</label>
              <textarea
                value={natureOfIntervention}
                onChange={(e) => setNatureOfIntervention(e.target.value)}
                rows={2}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>ACTION TAKEN / WORK DONE</label>
              <textarea
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                rows={3}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>WORK COMPLETED?</label>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-ink-200">
                  <input type="radio" checked={workCompleted} onChange={() => setWorkCompleted(true)} className="accent-cyan-accent" />
                  Yes
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-200">
                  <input type="radio" checked={!workCompleted} onChange={() => setWorkCompleted(false)} className="accent-cyan-accent" />
                  No
                </label>
              </div>
            </div>
            {!workCompleted && (
              <div>
                <label className={labelClass}>PLEASE GIVE DETAILS</label>
                <textarea
                  value={incompleteDetails}
                  onChange={(e) => setIncompleteDetails(e.target.value)}
                  rows={2}
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            )}
            <PhotoPicker label="PHOTOS OF WORK DONE" files={workDonePhotos} onChange={setWorkDonePhotos} />
          </div>
        </Panel>

        <Panel title="Technicians & Time">
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>TECHNICIAN(S) INVOLVED</label>
              <div className="mt-2 flex max-h-32 flex-col gap-1.5 overflow-y-auto rounded-md border border-ink-700 bg-ink-950 p-3">
                {employees.length === 0 ? (
                  <p className="text-xs text-ink-500">No employees yet.</p>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>TIME IN</label>
                <input type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
              <div>
                <label className={labelClass}>TIME OUT</label>
                <input type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Warranty & Report">
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>EQUIPMENT UNDER WARRANTY</label>
              <div className="mt-2 flex gap-4">
                {(
                  [
                    ['YES', 'Yes'],
                    ['NO', 'No'],
                    ['UNKNOWN', "D.N"],
                  ] as [WarrantyStatus, string][]
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-ink-200">
                    <input
                      type="radio"
                      checked={warrantyStatus === value}
                      onChange={() => setWarrantyStatus(value)}
                      className="accent-cyan-accent"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>TECHNICIAN'S REPORT</label>
              <textarea
                value={technicianReport}
                onChange={(e) => setTechnicianReport(e.target.value)}
                rows={2}
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>COMMENTS / RECOMMENDATIONS</label>
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className={`mt-2 ${inputClass}`} />
            </div>
            <div>
              <label className={labelClass}>OTHER IMPORTANT INFORMATION</label>
              <textarea
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
                rows={2}
                placeholder="Anything else worth recording for this customer/equipment's history..."
                className={`mt-2 ${inputClass}`}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Sign & Attach">
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>SIGNED BY</label>
              <input
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                placeholder="Your name"
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>SIGNATURE</label>
              <div className="mt-2">
                <SignaturePad onChange={setSignatureData} />
              </div>
            </div>
            <div>
              <label className={labelClass}>UPLOAD SIGNED INTERVENTION SHEET</label>
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
              <p className="mt-1 text-xs text-ink-500">Photo or PDF of the paper form, signed by the customer. Max 8MB.</p>
            </div>
          </div>
        </Panel>

        {formError && <p className="text-sm text-red-400">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-md bg-cyan-accent px-6 py-2.5 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </form>
    </div>
  )
}

export default InterventionReportFormPage
