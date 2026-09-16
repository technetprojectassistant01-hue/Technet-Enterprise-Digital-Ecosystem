import type { Role } from './api'

// Mirrors server/src/lib/roles.ts - kept in sync manually since client and
// server don't share a package. Used to hide write actions (Add/Edit/Delete)
// from roles that can't use them, instead of showing a button that 403s.
export const SALES_ROLES: readonly Role[] = ['ADMIN', 'SALES_OFFICER']
export const FINANCE_ROLES: readonly Role[] = ['ADMIN', 'FINANCE_OFFICER']
/** Customer registration/editing: Sales normally owns this, but Finance also needs it (billing contacts, VAT details). */
export const CUSTOMER_MANAGE_ROLES: readonly Role[] = ['ADMIN', 'SALES_OFFICER', 'FINANCE_OFFICER']
/** Marketing calendar (Phase 1): no confirmed owner yet - defaulted to Sales as the closest
 * adjacent function, same pragmatic-default pattern as CUSTOMER_MANAGE_ROLES. */
export const MARKETING_ROLES: readonly Role[] = ['ADMIN', 'SALES_OFFICER']
/** Read-only visibility into the Quote Request queue for Operations Managers, alongside Sales' full edit rights. */
export const QUOTE_REQUEST_VIEW_ROLES: readonly Role[] = ['ADMIN', 'SALES_OFFICER', 'OPERATIONS_MANAGER']
export const PROCUREMENT_ROLES: readonly Role[] = ['ADMIN', 'STOREKEEPER']
/** Technet Store tools & equipment: register tools, issue them against requests, record returns. */
export const TOOL_MANAGE_ROLES: readonly Role[] = ['ADMIN', 'STOREKEEPER']
export const HR_ROLES: readonly Role[] = ['ADMIN', 'HR_OFFICER']

/**
 * Reading another person's uploaded personal documents — ID card, passport, medical notes,
 * certificates, from the HR employee profile. Briefly HR-only on 2026-09-16; the user then decided
 * the same day that an admin should see everything, so ADMIN is back. Staff keep full control of
 * their own under My Documents, and admins have no My Documents page of their own.
 */
export const PERSONAL_DOCUMENT_ROLES: readonly Role[] = ['ADMIN', 'HR_OFFICER']
/** Read-only "who's around today" visibility for Operations Managers, alongside HR's full edit rights. */
export const WORKFORCE_VIEW_ROLES: readonly Role[] = ['ADMIN', 'HR_OFFICER', 'OPERATIONS_MANAGER']
export const OPS_MANAGE_ROLES: readonly Role[] = ['ADMIN', 'OPERATIONS_MANAGER']
/** Everyone who isn't in OPS_MANAGE_ROLES — hides manager-only Operations menu items (Team Attendance, Field Operations). */
export const NON_OPS_MANAGE_ROLES: readonly Role[] = [
  'SALES_OFFICER',
  'FINANCE_OFFICER',
  'STOREKEEPER',
  'HR_OFFICER',
  'FIELD_TECHNICIAN',
  'EMPLOYEE',
]
export const OPS_SUBMIT_ROLES: readonly Role[] = ['ADMIN', 'OPERATIONS_MANAGER', 'FIELD_TECHNICIAN', 'EMPLOYEE']
export const DOCUMENT_ROLES: readonly Role[] = [
  'ADMIN',
  'SALES_OFFICER',
  'FINANCE_OFFICER',
  'HR_OFFICER',
  'OPERATIONS_MANAGER',
]

/** Field technicians and generic employees only work within Operations and the Store. */
export const FIELD_ONLY_ROLES: readonly Role[] = ['FIELD_TECHNICIAN', 'EMPLOYEE']

/**
 * Sales/finance/marketing modules, hidden from field staff and from HR (user request
 * 2026-09-16: HR works in Technet HR, not in ERP, Connect or Marketing).
 */
export const NON_COMMERCIAL_ROLES: readonly Role[] = ['FIELD_TECHNICIAN', 'EMPLOYEE', 'HR_OFFICER']

/** Reading the whole team's site attendance: Operations supervises it, HR validates and pays on it. */
export const ATTENDANCE_VIEW_ROLES: readonly Role[] = ['ADMIN', 'OPERATIONS_MANAGER', 'HR_OFFICER']

/**
 * Roles that run the system rather than being tracked by it: no check-in card, no My Leave and no
 * My Documents. They read everyone else's instead, from Technet HR (user request 2026-09-16 —
 * "hr is not supposed to check in and check out, it should have the same like admin").
 */
export const ADMINISTRATIVE_ROLES: readonly Role[] = ['ADMIN', 'HR_OFFICER']

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
