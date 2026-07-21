import type { BadgeTone } from '../dashboard/ui'
import type { ContractStatus, InvoiceStatus, QuotationStatus } from '../lib/api'

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
