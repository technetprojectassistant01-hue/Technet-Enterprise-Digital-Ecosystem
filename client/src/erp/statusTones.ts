import type { BadgeTone } from '../dashboard/ui'
import type {
  ContractStatus,
  InvoiceStatus,
  QuotationStatus,
  EmploymentStatus,
  ProjectStatus,
  RequisitionStatus,
  PurchaseOrderStatus,
  WorkOrderStatus,
  ReportStatus,
  LeaveRequestStatus,
  AttendanceStatus,
} from '../lib/api'

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

export const attendanceStatusTone: Record<AttendanceStatus, BadgeTone> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'danger',
  ON_LEAVE: 'accent',
  PUBLIC_HOLIDAY: 'neutral',
  REST_DAY: 'neutral',
}

export const leaveRequestStatusTone: Record<LeaveRequestStatus, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
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

export const requisitionStatusTone: Record<RequisitionStatus, BadgeTone> = {
  SUBMITTED: 'warning',
  APPROVED: 'accent',
  REJECTED: 'danger',
  CONVERTED: 'success',
}

export const purchaseOrderStatusTone: Record<PurchaseOrderStatus, BadgeTone> = {
  DRAFT: 'neutral',
  SENT: 'warning',
  PARTIALLY_RECEIVED: 'warning',
  FULLY_RECEIVED: 'accent',
  CLOSED: 'success',
  CANCELLED: 'danger',
}

export const workOrderStatusTone: Record<WorkOrderStatus, BadgeTone> = {
  SCHEDULED: 'neutral',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}

export const reportStatusTone: Record<ReportStatus, BadgeTone> = {
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
}
