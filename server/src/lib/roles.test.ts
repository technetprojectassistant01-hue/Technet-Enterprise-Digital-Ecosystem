import { describe, expect, it } from "vitest";
import { isAdminLike } from "./roles";

describe("isAdminLike", () => {
  it("is true for ADMIN and OPERATIONS_MANAGER", () => {
    expect(isAdminLike("ADMIN")).toBe(true);
    expect(isAdminLike("OPERATIONS_MANAGER")).toBe(true);
  });

  it("is false for every other role and for no role", () => {
    for (const role of ["SALES_OFFICER", "FINANCE_OFFICER", "STOREKEEPER", "HR_OFFICER", "FIELD_TECHNICIAN", "EMPLOYEE"]) {
      expect(isAdminLike(role)).toBe(false);
    }
    expect(isAdminLike(undefined)).toBe(false);
    expect(isAdminLike(null)).toBe(false);
  });
});
