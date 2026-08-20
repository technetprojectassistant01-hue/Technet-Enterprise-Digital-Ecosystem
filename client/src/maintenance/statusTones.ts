import type { BadgeTone } from '../dashboard/ui'
import type {
  AssetStatus,
  MaintenanceContractStatus,
  MaintenanceRequestPriority,
  MaintenanceRequestStatus,
  MaintenanceScheduleStatus,
} from '../lib/api'

export const assetStatusTone: Record<AssetStatus, BadgeTone> = {
  ACTIVE: 'accent',
  DECOMMISSIONED: 'neutral',
}

export const maintenanceContractStatusTone: Record<MaintenanceContractStatus, BadgeTone> = {
  ACTIVE: 'accent',
  EXPIRED: 'warning',
  CANCELLED: 'danger',
}

export const requestPriorityTone: Record<MaintenanceRequestPriority, BadgeTone> = {
  LOW: 'neutral',
  MEDIUM: 'accent',
  HIGH: 'warning',
  URGENT: 'danger',
}

export const requestStatusTone: Record<MaintenanceRequestStatus, BadgeTone> = {
  SUBMITTED: 'warning',
  SCHEDULED: 'accent',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}

export const scheduleStatusTone: Record<MaintenanceScheduleStatus, BadgeTone> = {
  SCHEDULED: 'accent',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}
