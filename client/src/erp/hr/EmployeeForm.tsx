import { useState, type FormEvent, type ReactNode } from 'react'
import type {
  ContractType,
  Employee,
  EmployeeInput,
  EmploymentStatus,
  Gender,
} from '../../lib/api'
import { inputClass, labelClass, primaryButtonClass } from './formStyles'

const STATUSES: EmploymentStatus[] = ['ACTIVE', 'ON_LEAVE', 'TERMINATED']
const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER']
const CONTRACT_TYPES: ContractType[] = ['PERMANENT', 'FIXED_TERM', 'CASUAL', 'INTERN', 'CONSULTANT']

export interface EmployeeFormState {
  employeeCode: string
  firstName: string
  lastName: string
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
}: {
  form: EmployeeFormState
  setForm: (form: EmployeeFormState) => void
  onSubmit: (e: FormEvent) => void
  submitting: boolean
  error: string | null
  submitLabel: string
}) {
  const [showPayroll, setShowPayroll] = useState(false)
  const set = (patch: Partial<EmployeeFormState>) => setForm({ ...form, ...patch })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Section title="IDENTITY & CONTACT">
        <Field label="EMPLOYEE CODE">
          <input
            value={form.employeeCode}
            onChange={(e) => set({ employeeCode: e.target.value })}
            required
            className={inputClass}
          />
        </Field>
        <Field label="STATUS">
          <select
            value={form.employmentStatus}
            onChange={(e) => set({ employmentStatus: e.target.value as EmploymentStatus })}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="FIRST NAME">
          <input
            value={form.firstName}
            onChange={(e) => set({ firstName: e.target.value })}
            required
            className={inputClass}
          />
        </Field>
        <Field label="LAST NAME">
          <input
            value={form.lastName}
            onChange={(e) => set({ lastName: e.target.value })}
            required
            className={inputClass}
          />
        </Field>
        <Field label="NATIONAL ID (NIC)">
          <input
            value={form.nationalId}
            onChange={(e) => set({ nationalId: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="DATE OF BIRTH">
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set({ dateOfBirth: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="GENDER">
          <select
            value={form.gender}
            onChange={(e) => set({ gender: e.target.value as Gender | '' })}
            className={inputClass}
          >
            <option value="">—</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g.charAt(0) + g.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="PHONE">
          <input
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder="e.g. 5712 3456"
            className={inputClass}
          />
        </Field>
        <Field label="EMAIL">
          <input
            type="email"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="ADDRESS" full>
          <textarea
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
            rows={2}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title="EMPLOYMENT">
        <Field label="POSITION">
          <input
            value={form.position}
            onChange={(e) => set({ position: e.target.value })}
            placeholder="e.g. Senior Technician"
            className={inputClass}
          />
        </Field>
        <Field label="DEPARTMENT">
          <input
            value={form.department}
            onChange={(e) => set({ department: e.target.value })}
            placeholder="e.g. Operations"
            className={inputClass}
          />
        </Field>
        <Field label="CONTRACT TYPE">
          <select
            value={form.contractType}
            onChange={(e) => set({ contractType: e.target.value as ContractType | '' })}
            className={inputClass}
          >
            <option value="">—</option>
            {CONTRACT_TYPES.map((c) => (
              <option key={c} value={c}>
                {c.replace('_', ' ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="JOB GRADE">
          <input
            value={form.jobGrade}
            onChange={(e) => set({ jobGrade: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="HIRE DATE">
          <input
            type="date"
            value={form.hireDate}
            onChange={(e) => set({ hireDate: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="PROBATION ENDS">
          <input
            type="date"
            value={form.probationEndDate}
            onChange={(e) => set({ probationEndDate: e.target.value })}
            className={inputClass}
          />
        </Field>
        {form.contractType === 'FIXED_TERM' && (
          <Field label="CONTRACT ENDS">
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
            <Field label="EXIT DATE">
              <input
                type="date"
                value={form.exitDate}
                onChange={(e) => set({ exitDate: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="EXIT REASON" full>
              <input
                value={form.exitReason}
                onChange={(e) => set({ exitReason: e.target.value })}
                placeholder="e.g. Resignation, end of contract"
                className={inputClass}
              />
            </Field>
          </>
        )}
      </Section>

      <Section title="EMERGENCY CONTACT">
        <Field label="NAME">
          <input
            value={form.emergencyContactName}
            onChange={(e) => set({ emergencyContactName: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="PHONE">
          <input
            value={form.emergencyContactPhone}
            onChange={(e) => set({ emergencyContactPhone: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="RELATIONSHIP">
          <input
            value={form.emergencyContactRelation}
            onChange={(e) => set({ emergencyContactRelation: e.target.value })}
            placeholder="e.g. Spouse"
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
          PAYROLL DETAILS
          <span className="text-ink-500">{showPayroll ? 'Hide' : 'Show'}</span>
        </button>
        {showPayroll && (
          <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2">
            <Field label="BASIC SALARY (MUR)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.basicSalary}
                onChange={(e) => set({ basicSalary: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="BANK NAME">
              <input
                value={form.bankName}
                onChange={(e) => set({ bankName: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="BANK ACCOUNT NUMBER">
              <input
                value={form.bankAccountNumber}
                onChange={(e) => set({ bankAccountNumber: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </div>

      <Section title="NOTES">
        <Field label="INTERNAL NOTES" full>
          <textarea
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={3}
            placeholder="Anything else worth recording about this employee..."
            className={inputClass}
          />
        </Field>
      </Section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}

export default EmployeeForm
