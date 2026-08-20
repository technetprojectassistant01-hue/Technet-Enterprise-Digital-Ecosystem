import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2, CalendarDays } from 'lucide-react'
import * as api from '../../lib/api'
import type { PublicHoliday } from '../../lib/api'
import { Panel, Modal, EmptyState, TableSkeleton } from '../../dashboard/ui'
import { useToast } from '../../dashboard/ToastContext'
import { useConfirm } from '../../dashboard/ConfirmContext'
import { inputClass, labelClass, primaryButtonClass } from './formStyles'

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
  const toast = useToast()
  const confirm = useConfirm()

  const [year, setYear] = useState(currentYear())
  const [holidays, setHolidays] = useState<PublicHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
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
    setDate('')
    setName('')
    setFormError(null)
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!date) return setFormError('Date is required')
    if (!name.trim()) return setFormError('Name is required')

    setSubmitting(true)
    try {
      await api.createPublicHoliday({ date, name: name.trim() })
      toast.success('Holiday added')
      setShowForm(false)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add holiday')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(holiday: PublicHoliday) {
    const ok = await confirm({
      title: 'Delete holiday',
      message: `Remove "${holiday.name}" from the calendar? Leave and payroll will start counting this date as a working day again.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await api.deletePublicHoliday(holiday.id)
      toast.success('Holiday removed')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete holiday')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-400">
        Dates listed here are excluded from leave and payroll working-day counts. Several Mauritius
        public holidays (Chinese Spring Festival, Eid-Ul-Fitr, Ganesh Chaturthi, Diwali, and others
        tied to the lunar calendar) shift every year and are only confirmed by government gazette
        closer to the date — add each one once it's confirmed rather than guessing ahead.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className={labelClass}>YEAR</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || currentYear())}
            className={`w-28 ${inputClass}`}
          />
        </div>
        <button type="button" onClick={openCreate} className={primaryButtonClass}>
          <Plus className="h-4 w-4" />
          Add Holiday
        </button>
      </div>

      <Panel title={`Public Holidays — ${year}`}>
        {loading ? (
          <TableSkeleton rows={4} cols={2} />
        ) : holidays.length === 0 ? (
          <EmptyState icon={CalendarDays} message={`No holidays recorded for ${year} yet.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] tracking-widest text-ink-400">
                  <th className="px-3 py-3 font-semibold">DATE</th>
                  <th className="px-3 py-3 font-semibold">NAME</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} className="border-b border-ink-800 last:border-0">
                    <td className="px-3 py-3 text-ink-300">{formatDate(h.date)}</td>
                    <td className="px-3 py-3 font-medium text-ink-100">{h.name}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDelete(h)}
                          aria-label="Delete holiday"
                          className="text-ink-400 hover:text-red-400"
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
        <Modal title="Add Holiday" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>DATE</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>
            <div>
              <label className={labelClass}>NAME</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Independence Day"
                required
                className={`mt-2 ${inputClass}`}
              />
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button type="submit" disabled={submitting} className={`justify-center py-2.5 ${primaryButtonClass}`}>
              {submitting ? 'Saving…' : 'Add Holiday'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default HolidaysTab
