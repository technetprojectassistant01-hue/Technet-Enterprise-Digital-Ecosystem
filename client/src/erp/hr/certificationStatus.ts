import type { BadgeTone } from '../../dashboard/ui'
import type { Certification } from '../../lib/api'

export type CertificationState = 'NO_EXPIRY' | 'VALID' | 'EXPIRING' | 'EXPIRED'

/** Matches EXPIRING_SOON_DAYS on the server. */
export const EXPIRING_SOON_DAYS = 60

export function daysUntilExpiry(certification: Certification): number | null {
  if (!certification.expiryDate) return null
  const expiry = new Date(certification.expiryDate)
  if (Number.isNaN(expiry.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expiry.setHours(0, 0, 0, 0)
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000)
}

export function certificationState(certification: Certification): CertificationState {
  const days = daysUntilExpiry(certification)
  if (days === null) return 'NO_EXPIRY'
  if (days < 0) return 'EXPIRED'
  if (days <= EXPIRING_SOON_DAYS) return 'EXPIRING'
  return 'VALID'
}

export const certificationStateTone: Record<CertificationState, BadgeTone> = {
  NO_EXPIRY: 'neutral',
  VALID: 'success',
  EXPIRING: 'warning',
  EXPIRED: 'danger',
}

export const certificationStateLabel: Record<CertificationState, string> = {
  NO_EXPIRY: 'NO EXPIRY',
  VALID: 'VALID',
  EXPIRING: 'RENEW SOON',
  EXPIRED: 'EXPIRED',
}
