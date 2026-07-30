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
export const PROCUREMENT_ROLES = ["ADMIN", "STOREKEEPER"] as const;
export const HR_ROLES = ["ADMIN", "HR_OFFICER"] as const;

/** Create/edit/delete and approve/reject operations-side records. */
export const OPS_MANAGE_ROLES = ["ADMIN", "OPERATIONS_MANAGER"] as const;

/** Submitting field-generated records: technicians plus anyone who can manage them. */
export const OPS_SUBMIT_ROLES = ["ADMIN", "OPERATIONS_MANAGER", "FIELD_TECHNICIAN"] as const;

export const DOCUMENT_ROLES = [
  "ADMIN",
  "SALES_OFFICER",
  "FINANCE_OFFICER",
  "HR_OFFICER",
  "OPERATIONS_MANAGER",
] as const;
