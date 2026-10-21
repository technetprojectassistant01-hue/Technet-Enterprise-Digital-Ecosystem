import type { RoleGuide } from '../types'
import { ADMIN_GUIDE_MFE } from './adminGuide'
import { FINANCE_GUIDE_MFE } from './financeGuide'
import { HR_GUIDE_MFE } from './hrGuide'
import { OFFICE_GUIDE_MFE } from './officeGuide'
import { SALES_GUIDE_MFE } from './salesGuide'
import { STOREKEEPER_GUIDE_MFE } from './storekeeperGuide'
import { TECHNICIAN_GUIDE_MFE } from './technicianGuide'

/** The Kreol guides, in the same order as GUIDES in ../index.ts (one per English guide). */
export const MFE_GUIDES: RoleGuide[] = [
  ADMIN_GUIDE_MFE,
  HR_GUIDE_MFE,
  TECHNICIAN_GUIDE_MFE,
  STOREKEEPER_GUIDE_MFE,
  OFFICE_GUIDE_MFE,
  SALES_GUIDE_MFE,
  FINANCE_GUIDE_MFE,
]
