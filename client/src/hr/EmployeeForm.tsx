import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import * as api from '../lib/api'
import type {
  ContractType,
  Employee,
  EmployeeInput,
  EmploymentStatus,
  Gender,
  LinkableUser,
} from '../lib/api'
import { inputClass, labelClass, primaryButtonClass } from './formStyles'
import { useT, enumLabel } from '../i18n'

const STATUSES: EmploymentStatus[] = ['ACTIVE', 'ON_LEAVE', 'TERMINATED']
const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER']
const CONTRACT_TYPES: ContractType[] = ['PERMANENT', 'FIXED_TERM', 'CASUAL', 'INTERN', 'CONSULTANT']

export interface EmployeeFormState {
  employeeCode: string
  firstName: string
  lastName: string
  userId: string
  email: string
  phone: string
  position: string
  department: string
  employmentStatus: EmploymentStatus
  hireDate: string

  nationalId: string
  dateOfBirth: string
  gender: Gender | ''
  address: string

  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string

  contractType: ContractType | ''
  jobGrade: string
  probationEndDate: string
  contractEndDate: string
  exitDate: string
  exitReason: string

  basicSalary: string
  bankName: string
  bankAccountNumber: string

  notes: string
}

export const EMPTY_EMPLOYEE_FORM: EmployeeFormState = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  userId: '',
  email: '',
  phone: '',
  position: '',
  department: '',
  employmentStatus: 'ACTIVE',
  hireDate: '',
  nationalId: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  contractType: '',
  jobGrade: '',
  probationEndDate: '',
  contractEndDate: '',
  exitDate: '',
  exitReason: '',
  basicSalary: '',
  bankName: '',
  bankAccountNumber: '',
  notes: '',
}

function dateInput(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

export function toEmployeeFormState(e: Employee): EmployeeFormState {
  return {
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
    userId: e.userId || '',
    email: e.email || '',
    phone: e.phone || '',
    position: e.position || '',
    department: e.department || '',
    employmentStatus: e.employmentStatus,
    hireDate: dateInput(e.hireDate),
    nationalId: e.nationalId || '',
    dateOfBirth: dateInput(e.dateOfBirth),
    gender: e.gender || '',
    address: e.address || '',
    emergencyContactName: e.emergencyContactName || '',
    emergencyContactPhone: e.emergencyContactPhone || '',
    emergencyContactRelation: e.emergencyContactRelation || '',
    contractType: e.contractType || '',
    jobGrade: e.jobGrade || '',
    probationEndDate: dateInput(e.probationEndDate),
    contractEndDate: dateInput(e.contractEndDate),
    exitDate: dateInput(e.exitDate),
    exitReason: e.exitReason || '',
    basicSalary: e.basicSalary || '',
    bankName: e.bankName || '',
    bankAccountNumber: e.bankAccountNumber || '',
    notes: e.notes || '',
  }
}

/** The API clears optional fields when sent an empty string, so send the form as-is. */
export function toEmployeeInput(form: EmployeeFormState): EmployeeInput {
  return { ...form }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-ink-700 p-4">
      <legend className="px-2 text-xs font-semibold tracking-widest text-ink-400">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string
  children: ReactNode
  full?: boolean
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <label className={labelClass}>{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function EmployeeForm({
  form,
  setForm,
  onSubmit,
  submitting,
  error,
  submitLabel,
  isCreate = false,
}: {
  form: EmployeeFormState
  setForm: (form: EmployeeFormState) => void
  onSubmit: (e: FormEvent) => void
  submitting: boolean
  error: string | null
  submitLabel: string
  /** The employee code is server-generated on create (see CLAUDE.md) — shown read-only there,
   * editable once the employee exists in case HR needs to correct it. */
  isCreate?: boolean
}) {
  const t = useT()
  const f = t.people.form
  const [showPayroll, setShowPayroll] = useState(false)
  const [linkableUsers, setLinkableUsers] = useState<LinkableUser[]>([])
  const set = (patch: Partial<EmployeeFormState>) => setForm({ ...form, ...patch })

  useEffect(() => {
    api
      .listLinkableUsers()
      .then(({ users }) => setLinkableUsers(users))
      .catch(() => setLinkableUsers([]))
  }, [])

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Section title={f.accountAccess}>
        <Field label={f.linkedLogin} full>
          <select value={form.userId} onChange={(e) => set({ userId: e.target.value })} className={inputClass}>
            <option value="">{f.notLinked}</option>
            {linkableUsers.map((u) => (
              <option
                key={u.id}
                value={u.id}
                disabled={u.linkedEmployeeId !== null && u.id !== form.userId}
              >
                {u.email} ({t.roles[u.role]})
                {u.linkedEmployeeId !== null && u.id !== form.userId ? f.alreadyLinked : ''}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title={f.identity}>
        <Field label={f.employeeCode}>
          {isCreate ? (
            <p className="text-sm text-ink-400">{f.codeAutomatic}</p>
          ) : (
            <input
              value={form.employeeCode}
              onChange={(e) => set({ employeeCode: e.target.value })}
              required
              className={inputClass}
            />
          )}
        </Field>
        <Field label={f.status}>
          <select
            value={form.employmentStatus}
            onChange={(e) => set({ employmentStatus: e.target.value as EmploymentStatus })}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {enumLabel(t.labels.employmentStatus, s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={f.firstName}>
          <input
            value={form.firstName}
            onChange={(e) => set({ firstName: e.target.value })}
            required
            className={inputClass}
          />
        </Field>
        <Field label={f.lastName}>
          <input
            value={form.lastName}
            onChange={(e) => set({ lastName: e.target.value })}
            required
            className={inputClass}
          />
        </Field>
        <Field label={f.nationalId}>
          <input
            value={form.nationalId}
            onChange={(e) => set({ nationalId: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={f.dateOfBirth}>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set({ dateOfBirth: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={f.gender}>
          <select
            value={form.gender}
            onChange={(e) => set({ gender: e.target.value as Gender | '' })}
            className={inputClass}
          >
            <option value="">—</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {t.people.gender[g]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={f.phone}>
          <input
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder={f.phonePlaceholder}
            className={inputClass}
          />
        </Field>
        <Field label={f.email}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={f.address} full>
          <textarea
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
            rows={2}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title={f.employment}>
        <Field label={f.position}>
          <input
            value={form.position}
            onChange={(e) => set({ position: e.target.value })}
            placeholder={f.positionPlaceholder}
            className={inputClass}
          />
        </Field>
        <Field label={f.department}>
          <input
            value={form.department}
            onChange={(e) => set({ department: e.target.value })}
            placeholder={f.departmentPlaceholder}
            className={inputClass}
          />
        </Field>
        <Field label={f.contractType}>
          <select
            value={form.contractType}
            onChange={(e) => set({ contractType: e.target.value as ContractType | '' })}
            className={inputClass}
          >
            <option value="">—</option>
            {CONTRACT_TYPES.map((c) => (
              <option key={c} value={c}>
                {enumLabel(t.people.contractType, c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={f.jobGrade}>
          <input
            value={form.jobGrade}
            onChange={(e) => set({ jobGrade: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={f.hireDate}>
          <input
            type="date"
            value={form.hireDate}
            onChange={(e) => set({ hireDate: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={f.probationEnds}>
          <input
            type="date"
            value={form.probationEndDate}
            onChange={(e) => set({ probationEndDate: e.target.value })}
            className={inputClass}
          />
        </Field>
        {form.contractType === 'FIXED_TERM' && (
          <Field label={f.contractEnds}>
            <input
              type="date"
              value={form.contractEndDate}
              onChange={(e) => set({ contractEndDate: e.target.value })}
              className={inputClass}
            />
          </Field>
        )}
        {form.employmentStatus === 'TERMINATED' && (
          <>
            <Field label={f.exitDate}>
              <input
                type="date"
                value={form.exitDate}
                onChange={(e) => set({ exitDate: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={f.exitReason} full>
              <input
                value={form.exitReason}
                onChange={(e) => set({ exitReason: e.target.value })}
                placeholder={f.exitReasonPlaceholder}
                className={inputClass}
              />
            </Field>
          </>
        )}
      </Section>

      <Section title={f.emergencyContact}>
        <Field label={f.name}>
          <input
            value={form.emergencyContactName}
            onChange={(e) => set({ emergencyContactName: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={f.phone}>
          <input
            value={form.emergencyContactPhone}
            onChange={(e) => set({ emergencyContactPhone: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={f.relationship}>
          <input
            value={form.emergencyContactRelation}
            onChange={(e) => set({ emergencyContactRelation: e.target.value })}
            placeholder={f.relationshipPlaceholder}
            className={inputClass}
          />
        </Field>
      </Section>

      <div className="rounded-lg border border-ink-700">
        <button
          type="button"
          onClick={() => setShowPayroll((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold tracking-widest text-ink-400 hover:text-ink-100"
        >
          {f.payrollDetails}
          <span className="text-ink-400">{showPayroll ? f.hide : f.show}</span>
        </button>
        {showPayroll && (
          <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2">
            <Field label={f.basicSalary}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.basicSalary}
                onChange={(e) => set({ basicSalary: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={f.bankName}>
              <input
                value={form.bankName}
                onChange={(e) => set({ bankName: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={f.bankAccount}>
              <input
                value={form.bankAccountNumber}
                onChange={(e) => set({ bankAccountNumber: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </div>

      <Section title={f.notes}>
        <Field label={f.internalNotes} full>
          <textarea
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={3}
            placeholder={f.notesPlaceholder}
            className={inputClass}
          />
        </Field>
      </Section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
        {submitting ? f.saving : submitLabel}
      </button>
    </form>
  )
}

export default EmployeeForm
