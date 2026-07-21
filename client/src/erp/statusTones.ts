import type { BadgeTone } from '../dashboard/ui'
import type { ContractStatus, InvoiceStatus, QuotationStatus, EmploymentStatus, ProjectStatus } from '../lib/api'

export const contractStatusTone: Record<ContractStatus, BadgeTone> = {
  PLANNING: 'neutral',
  IN_PROGRESS: 'accent',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}

export const invoiceStatusTone: Record<InvoiceStatus, BadgeTone> = {
  DRAFT: 'neutral',
  SENT: 'warning',
  PAID: 'accent',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
}

export const quotationStatusTone: Record<QuotationStatus, BadgeTone> = {
  DRAFT: 'neutral',
  SENT: 'warning',
  ACCEPTED: 'accent',
  REJECTED: 'danger',
  EXPIRED: 'neutral',
}

export const employmentStatusTone: Record<EmploymentStatus, BadgeTone> = {
  ACTIVE: 'accent',
  ON_LEAVE: 'warning',
  TERMINATED: 'neutral',
}

export const projectStatusTone: Record<ProjectStatus, BadgeTone> = {
  QUOTED: 'neutral',
  APPROVED: 'warning',
  IN_PROGRESS: 'accent',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'danger',
}

export const projectStatusTransitions: Record<ProjectStatus, ProjectStatus[]> = {
  QUOTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
}
