import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, CalendarDays } from 'lucide-react'
import * as api from '../../lib/api'
import type { PublicHoliday } from '../../lib/api'
import { Panel, Modal, EmptyState, TableSkeleton } from '../../dashboard/ui'
import { useToast } from '../../dashboard/ToastContext'
import { useConfirm } from '../../dashboard/ConfirmContext'
import { inputClass, labelClass, primaryButtonClass } from './formStyles'
import { useT } from '../../i18n'

function currentYear(): number {
  return new Date().getUTCFullYear()
}

function formatDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function HolidaysTab() {
  const t = useT()
  const toast = useToast()
  const confirm = useConfirm()

  const [year, setYear] = useState(currentYear())
  const [holidays, setHolidays] = useState<PublicHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PublicHoliday | null>(null)
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api
      .listPublicHolidays(year)
      .then(({ holidays }) => setHolidays(holidays))
      .catch(() => setHolidays([]))
      .finally(() => setLoading(false))
  }, [year])

  useEffect(load, [load])

  function openCreate() {
    setEditing(null)
    setDate('')
    setName('')
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(holiday: PublicHoliday) {
    setEditing(holiday)
    setDate(holiday.date.slice(0, 10))
    setName(holiday.name)
    setFormError(null)
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!date) return setFormError(t.hr.holidays.dateRequired)
    if (!name.trim()) return setFormError(t.hr.holidays.nameRequired)

    setSubmitting(true)
    try {
      if (editing) {
        await api.updatePublicHoliday(editing.id, { date, name: name.trim() })
        toast.success(t.hr.holidays.updated)
      } else {
        await api.createPublicHoliday({ date, name: name.trim() })
        toast.success(t.hr.holidays.added)
      }
      setShowForm(false)
      setEditing(null)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t.hr.holidays.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(holiday: PublicHoliday) {
    const ok = await confirm({
      title: t.hr.holidays.deleteTitle,
      message: t.hr.holidays.deleteMessage(holiday.name),
      confirmLabel: t.shared.delete,
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deletePublicHoliday(holiday.id)
      toast.success(t.hr.holidays.removed)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.hr.holidays.deleteFailed)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-400">{t.hr.holidays.note}</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className={labelClass}>{t.hr.holidays.year}</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || currentYear())}
            className={`w-28 ${inputClass}`}
          />
        </div>
        <button type="button" onClick={openCreate} className={primaryButtonClass}>
          <Plus className="h-4 w-4" />
          {t.hr.holidays.add}
        </button>
      </div>

      <Panel title={t.hr.holidays.panelTitle(year)}>
        {loading ? (
          <TableSkeleton rows={4} cols={2} />
        ) : holidays.length === 0 ? (
          <EmptyState icon={CalendarDays} message={t.hr.holidays.empty(year)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">{t.shared.date}</th>
                  <th className="px-3 py-3 font-semibold">{t.shared.name}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-300">{formatDate(h.date)}</td>
                    <td className="px-3 py-3 font-medium text-ink-100">{h.name}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-3 text-ink-400">
                        <button
                          type="button"
                          onClick={() => openEdit(h)}
                          aria-label={t.hr.holidays.editAria}
                          className="hover:text-ink-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(h)}
                          aria-label={t.hr.holidays.deleteTitle}
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
          title={editing ? t.hr.holidays.edit : t.hr.holidays.add}
          onClose={() => {
            setShowForm(false)
            setEditing(null)
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>{t.shared.date}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>{t.shared.name}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.hr.holidays.namePlaceholder}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? t.shared.saving : editing ? t.shared.saveChanges : t.hr.holidays.add}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default HolidaysTab
