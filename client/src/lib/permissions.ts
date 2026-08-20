import type { Role } from './api'

// Mirrors server/src/lib/roles.ts - kept in sync manually since client and
// server don't share a package. Used to hide write actions (Add/Edit/Delete)
// from roles that can't use them, instead of showing a button that 403s.
export const SALES_ROLES: readonly Role[] = ['ADMIN', 'SALES_OFFICER']
export const FINANCE_ROLES: readonly Role[] = ['ADMIN', 'FINANCE_OFFICER']
export const PROCUREMENT_ROLES: readonly Role[] = ['ADMIN', 'STOREKEEPER']
export const HR_ROLES: readonly Role[] = ['ADMIN', 'HR_OFFICER']
/** Read-only "who's around today" visibility for Operations Managers, alongside HR's full edit rights. */
export const WORKFORCE_VIEW_ROLES: readonly Role[] = ['ADMIN', 'HR_OFFICER', 'OPERATIONS_MANAGER']
export const OPS_MANAGE_ROLES: readonly Role[] = ['ADMIN', 'OPERATIONS_MANAGER']
export const OPS_SUBMIT_ROLES: readonly Role[] = ['ADMIN', 'OPERATIONS_MANAGER', 'FIELD_TECHNICIAN', 'EMPLOYEE']
export const DOCUMENT_ROLES: readonly Role[] = [
  'ADMIN',
  'SALES_OFFICER',
  'FINANCE_OFFICER',
  'HR_OFFICER',
  'OPERATIONS_MANAGER',
]

/** Field technicians and generic employees only work within Operations and Maintenance. */
export const FIELD_ONLY_ROLES: readonly Role[] = ['FIELD_TECHNICIAN', 'EMPLOYEE']

/** Everyone except ADMIN - used to hide admin-only nav items (e.g. Technet Insight). */
export const NON_ADMIN_ROLES: readonly Role[] = [
  'SALES_OFFICER',
  'FINANCE_OFFICER',
  'STOREKEEPER',
  'HR_OFFICER',
  'OPERATIONS_MANAGER',
  'FIELD_TECHNICIAN',
  'EMPLOYEE',
]

export function hasRole(role: Role | undefined, allowed: readonly Role[]): boolean {
  return !!role && allowed.includes(role)
}
