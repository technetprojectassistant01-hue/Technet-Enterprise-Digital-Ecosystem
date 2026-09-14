import type { BadgeTone } from '../dashboard/ui'
import type { ToolCondition, ToolRequestStatus, ToolStatus } from '../lib/api'

export const toolStatusTone: Record<ToolStatus, BadgeTone> = {
  AVAILABLE: 'success',
  CHECKED_OUT: 'accent',
  UNDER_REPAIR: 'warning',
  RETIRED: 'neutral',
}

export const toolConditionTone: Record<ToolCondition, BadgeTone> = {
  GOOD: 'success',
  FAIR: 'warning',
  DAMAGED: 'danger',
}

export const toolRequestStatusTone: Record<ToolRequestStatus, BadgeTone> = {
  PENDING: 'warning',
  ISSUED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
}

/** "YYYY-MM-DD" of a stored date. Dates here are whole days, saved as UTC midnight. */
export function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

/** A tool is overdue once its expected return day has passed without it coming back. */
export function isOverdue(expectedReturnAt: string | null): boolean {
  if (!expectedReturnAt) return false
  const today = new Date()
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return dayOf(expectedReturnAt) < localToday
}
