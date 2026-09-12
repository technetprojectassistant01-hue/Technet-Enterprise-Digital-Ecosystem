import { useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Layers, Sparkles } from 'lucide-react'
import * as api from '../../lib/api'
import type { LeaveType } from '../../lib/api'
import { Panel, Modal, Badge, EmptyState } from '../../dashboard/ui'
import { useToast } from '../../dashboard/ToastContext'
import { useConfirm } from '../../dashboard/ConfirmContext'
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from './formStyles'
import { useT } from '../../i18n'

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
  const t = useT()
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
      toast.success(t.hr.leaveTypes.seeded)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.hr.leaveTypes.seedFailed)
    } finally {
      setSeeding(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.code.trim()) return setFormError(t.hr.leaveTypes.codeRequired)
    if (!form.name.trim()) return setFormError(t.hr.leaveTypes.nameRequired)

    const days = Number(form.daysPerYear)
    if (!Number.isFinite(days) || days < 0) return setFormError(t.hr.leaveTypes.daysInvalid)

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
      toast.success(editing ? t.hr.leaveTypes.updated : t.hr.leaveTypes.created)
      setShowForm(false)
      setEditing(null)
      onChanged()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.hr.leaveTypes.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(type: LeaveType) {
    const ok = await confirm({
      title: t.hr.leaveTypes.deleteTitle,
      message: t.hr.leaveTypes.deleteMessage(type.name),
      confirmLabel: t.shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deleteLeaveType(type.id)
      toast.success(t.hr.leaveTypes.deleted)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.hr.leaveTypes.deleteFailed)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-end gap-3">
        {leaveTypes.length === 0 && (
          <button type="button" onClick={handleSeed} disabled={seeding} className={secondaryButtonClass}>
            <Sparkles className="h-4 w-4" />
            {t.hr.leaveTypes.useDefaults}
          </button>
        )}
        <button type="button" onClick={openCreate} className={primaryButtonClass}>
          <Plus className="h-4 w-4" />
          {t.hr.leaveTypes.add}
        </button>
      </div>

      <Panel title={t.hr.leaveTypes.panel}>
        {leaveTypes.length === 0 ? (
          <EmptyState
            icon={Layers}
            message={t.hr.leaveTypes.empty}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.hr.leaveTypes.colCode}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.name}</th>
                  <th className="px-3 py-3 font-semibold">{t.hr.leaveTypes.colDays}</th>
                  <th className="px-3 py-3 font-semibold">{t.hr.leaveTypes.colPaid}</th>
                  <th className="px-3 py-3 font-semibold">{t.hr.leaveTypes.colDocs}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.status}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((type) => (
                  <tr key={type.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 font-mono text-ink-300">{type.code}</td>
                    <td className="px-3 py-3 font-medium text-ink-100">{type.name}</td>
                    <td className="px-3 py-3 text-ink-300">{type.daysPerYear}</td>
                    <td className="px-3 py-3 text-ink-300">{type.paid ? t.shared.yes : t.shared.no}</td>
                    <td className="px-3 py-3 text-ink-300">{type.requiresDocs ? t.shared.yes : t.shared.no}</td>
                    <td className="px-3 py-3">
                      <Badge tone={type.active ? 'accent' : 'neutral'}>
                        {type.active ? t.hr.leaveTypes.active : t.hr.leaveTypes.inactive}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        <button
                          type="button"
                          onClick={() => openEdit(type)}
                          aria-label={t.hr.leaveTypes.editAria}
                          className="hover:text-ink-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(type)}
                          aria-label={t.hr.leaveTypes.deleteTitle}
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
          title={editing ? t.hr.leaveTypes.edit : t.hr.leaveTypes.add}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.hr.leaveTypes.colCode}</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder={t.hr.leaveTypes.codePlaceholder}
                  required
                  className={`mt-2 ${inputClass}`}
                />
              </div>
              <div>
                <label className={labelClass}>{t.hr.leaveTypes.daysPerYear}</label>
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
              <label className={labelClass}>{t.shared.name}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.hr.leaveTypes.namePlaceholder}
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
                {t.hr.leaveTypes.paidLeave}
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-300">
                <input
                  type="checkbox"
                  checked={form.requiresDocs}
                  onChange={(e) => setForm({ ...form, requiresDocs: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-600 bg-ink-950"
                />
                {t.hr.leaveTypes.requiresDocs}
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-300">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-600 bg-ink-950"
                />
                {t.hr.leaveTypes.activeLabel}
              </label>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.shared.saving : editing ? t.shared.saveChanges : t.hr.leaveTypes.add}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default LeaveTypesTab
