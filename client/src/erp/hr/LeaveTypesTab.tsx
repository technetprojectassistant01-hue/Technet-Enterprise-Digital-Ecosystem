import { useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Layers, Sparkles } from 'lucide-react'
import * as api from '../../lib/api'
import type { LeaveType } from '../../lib/api'
import { Panel, Modal, Badge, EmptyState } from '../../dashboard/ui'
import { useToast } from '../../dashboard/ToastContext'
import { useConfirm } from '../../dashboard/ConfirmContext'
import { inputClass, labelClass, primaryButtonClass } from './formStyles'

interface FormState {
  code: string
  name: string
  daysPerYear: string
  paid: boolean
  requiresDocs: boolean
  active: boolean
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  daysPerYear: '0',
  paid: true,
  requiresDocs: false,
  active: true,
}

function LeaveTypesTab({ leaveTypes, onChanged }: { leaveTypes: LeaveType[]; onChanged: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LeaveType | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [seeding, setSeeding] = useState(false)

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(type: LeaveType) {
    setForm({
      code: type.code,
      name: type.name,
      daysPerYear: type.daysPerYear,
      paid: type.paid,
      requiresDocs: type.requiresDocs,
      active: type.active,
    })
    setFormError(null)
    setEditing(type)
    setShowForm(true)
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      await api.seedLeaveTypes()
      toast.success('Default leave types created')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create defaults')
    } finally {
      setSeeding(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.code.trim()) return setFormError('Code is required')
    if (!form.name.trim()) return setFormError('Name is required')

    const days = Number(form.daysPerYear)
    if (!Number.isFinite(days) || days < 0) return setFormError('Days per year must be zero or more')

    setSubmitting(true)
    try {
      const input = {
        code: form.code,
        name: form.name,
        daysPerYear: days,
        paid: form.paid,
        requiresDocs: form.requiresDocs,
        active: form.active,
      }
      if (editing) {
        await api.updateLeaveType(editing.id, input)
      } else {
        await api.createLeaveType(input)
      }
      toast.success(editing ? 'Leave type updated' : 'Leave type created')
      setShowForm(false)
      setEditing(null)
      onChanged()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save leave type')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(type: LeaveType) {
    const ok = await confirm({
      title: 'Delete leave type',
      message: `Delete "${type.name}"? Types already used by requests cannot be deleted — deactivate them instead.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteLeaveType(type.id)
      toast.success('Leave type deleted')
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete leave type')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-end gap-3">
        {leaveTypes.length === 0 && (
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 rounded-md border border-ink-600 px-4 py-2 text-sm font-medium text-ink-100 hover:border-ink-500 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Use Mauritius defaults
          </button>
        )}
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-md bg-cyan-accent px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-accent-dark"
        >
          <Plus className="h-4 w-4" />
          Add Leave Type
        </button>
      </div>

      <Panel>
        {leaveTypes.length === 0 ? (
          <EmptyState
            icon={Layers}
            message="No leave types yet. Start from the Mauritius defaults, or add your own."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">CODE</th>
                  <th className="px-3 py-3 font-semibold">NAME</th>
                  <th className="px-3 py-3 font-semibold">DAYS / YEAR</th>
                  <th className="px-3 py-3 font-semibold">PAID</th>
                  <th className="px-3 py-3 font-semibold">DOCS REQUIRED</th>
                  <th className="px-3 py-3 font-semibold">STATUS</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((t) => (
                  <tr key={t.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-300">{t.code}</td>
                    <td className="px-3 py-3 font-medium text-ink-100">{t.name}</td>
                    <td className="px-3 py-3 text-ink-300">{t.daysPerYear}</td>
                    <td className="px-3 py-3 text-ink-300">{t.paid ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-3 text-ink-300">{t.requiresDocs ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={t.active ? 'accent' : 'neutral'}>
                        {t.active ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          aria-label="Edit leave type"
                          className="hover:text-ink-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          aria-label="Delete leave type"
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

      {showForm && (
        <Modal
          title={editing ? 'Edit Leave Type' : 'Add Leave Type'}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CODE</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. ANNUAL"
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>DAYS PER YEAR</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.daysPerYear}
                  onChange={(e) => setForm({ ...form, daysPerYear: e.target.value })}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>NAME</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Annual Leave"
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-ink-300">
                <input
                  type="checkbox"
                  checked={form.paid}
                  onChange={(e) => setForm({ ...form, paid: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-600 bg-ink-950"
                />
                Paid leave
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-300">
                <input
                  type="checkbox"
                  checked={form.requiresDocs}
                  onChange={(e) => setForm({ ...form, requiresDocs: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-600 bg-ink-950"
                />
                Requires supporting documents (e.g. medical certificate)
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-300">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-600 bg-ink-950"
                />
                Active
              </label>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={primaryButtonClass}>
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Add Leave Type'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default LeaveTypesTab
