export const ALL_ROLES = [
  "ADMIN",
  "SALES_OFFICER",
  "FINANCE_OFFICER",
  "STOREKEEPER",
  "HR_OFFICER",
  "OPERATIONS_MANAGER",
  "FIELD_TECHNICIAN",
  "EMPLOYEE",
] as const;

export type Role = (typeof ALL_ROLES)[number];

export const SALES_ROLES = ["ADMIN", "SALES_OFFICER"] as const;
export const FINANCE_ROLES = ["ADMIN", "FINANCE_OFFICER"] as const;

/** Customer registration/editing: Sales normally owns this, but Finance also needs it (billing contacts, VAT details). */
export const CUSTOMER_MANAGE_ROLES = ["ADMIN", "SALES_OFFICER", "FINANCE_OFFICER"] as const;

/** Marketing calendar (Phase 1): no confirmed owner yet - defaulted to Sales as the closest
 * adjacent function, same pragmatic-default pattern as CUSTOMER_MANAGE_ROLES. Trivially widened
 * once a manager confirms real ownership; deliberately not a new Role enum value. */
export const MARKETING_ROLES = ["ADMIN", "SALES_OFFICER"] as const;

/** Read-only visibility into the Quote Request queue for Operations Managers, alongside Sales' full edit rights. */
export const QUOTE_REQUEST_VIEW_ROLES = ["ADMIN", "SALES_OFFICER", "OPERATIONS_MANAGER"] as const;
export const PROCUREMENT_ROLES = ["ADMIN", "STOREKEEPER"] as const;
export const HR_ROLES = ["ADMIN", "HR_OFFICER"] as const;

/** Read-only "who's around today" visibility for Operations Managers, alongside HR's full edit rights. */
export const WORKFORCE_VIEW_ROLES = ["ADMIN", "HR_OFFICER", "OPERATIONS_MANAGER"] as const;

/** Create/edit/delete and approve/reject operations-side records. */
export const OPS_MANAGE_ROLES = ["ADMIN", "OPERATIONS_MANAGER"] as const;

/** Submitting field-generated records: technicians, generic employees, plus anyone who can manage them. */
export const OPS_SUBMIT_ROLES = ["ADMIN", "OPERATIONS_MANAGER", "FIELD_TECHNICIAN", "EMPLOYEE"] as const;

export const DOCUMENT_ROLES = [
  "ADMIN",
  "SALES_OFFICER",
  "FINANCE_OFFICER",
  "HR_OFFICER",
  "OPERATIONS_MANAGER",
] as const;

/** Field technicians and generic employees only work within Operations and Maintenance. */
export const NON_FIELD_ROLES = [
  "ADMIN",
  "SALES_OFFICER",
  "FINANCE_OFFICER",
  "STOREKEEPER",
  "HR_OFFICER",
  "OPERATIONS_MANAGER",
] as const;

/** Executive-level, cross-module reporting (Technet Insight). No dedicated Managing Director role exists yet, so this is admin-only. */
export const INSIGHT_ROLES = ["ADMIN"] as const;
