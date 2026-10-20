import type { RoleGuide } from '../types'
import { ADMIN_GUIDE_FR } from './adminGuide'
import { HR_GUIDE_FR } from './hrGuide'
import { OFFICE_GUIDE_FR } from './officeGuide'
import { SALES_GUIDE_FR } from './salesGuide'
import { STOREKEEPER_GUIDE_FR } from './storekeeperGuide'
import { TECHNICIAN_GUIDE_FR } from './technicianGuide'

/** The French guides, in the same order as GUIDES in ../index.ts (one per English guide). */
export const FR_GUIDES: RoleGuide[] = [
  ADMIN_GUIDE_FR,
  HR_GUIDE_FR,
  TECHNICIAN_GUIDE_FR,
  STOREKEEPER_GUIDE_FR,
  OFFICE_GUIDE_FR,
  SALES_GUIDE_FR,
]
