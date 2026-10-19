import type { Role } from '../lib/api'
import { hasRole } from '../lib/permissions'
import { ADMIN_GUIDE } from './adminGuide'
import { HR_GUIDE } from './hrGuide'
import { STOREKEEPER_GUIDE } from './storekeeperGuide'
import { TECHNICIAN_GUIDE } from './technicianGuide'
import type { RoleGuide } from './types'

/**
 * Every role guide written so far. Written role by role (Admin, HR, Staff Technician, Storekeeper, 2026-10-19); add each
 * new guide here and it appears in the menu for that role.
 */
export const GUIDES: RoleGuide[] = [ADMIN_GUIDE, HR_GUIDE, TECHNICIAN_GUIDE, STOREKEEPER_GUIDE]

/** The guide for a role, or null while that role's guide hasn't been written. */
export function guideFor(role: Role | undefined): RoleGuide | null {
  if (!role) return null
  // hasRole treats the Operations Manager as an admin, so they get the admin guide too.
  return GUIDES.find((g) => hasRole(role, g.roles)) ?? null
}

export type { GuideBlock, GuideChapter, GuideTopic, RoleGuide } from './types'
