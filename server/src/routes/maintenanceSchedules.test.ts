import { describe, expect, it } from "vitest";
import { SCHEDULE_ALLOWED_TRANSITIONS } from "./maintenanceSchedules";

describe("maintenance schedule status transitions", () => {
  it("allows completing or cancelling a scheduled visit", () => {
    expect(SCHEDULE_ALLOWED_TRANSITIONS.SCHEDULED).toContain("COMPLETED");
    expect(SCHEDULE_ALLOWED_TRANSITIONS.SCHEDULED).toContain("CANCELLED");
  });

  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(SCHEDULE_ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
    expect(SCHEDULE_ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
  });
});
