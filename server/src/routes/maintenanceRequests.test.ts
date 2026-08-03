import { describe, expect, it } from "vitest";
import { REQUEST_ALLOWED_TRANSITIONS } from "./maintenanceRequests";

describe("maintenance request status transitions", () => {
  it("allows scheduling or cancelling a submitted request", () => {
    expect(REQUEST_ALLOWED_TRANSITIONS.SUBMITTED).toContain("SCHEDULED");
    expect(REQUEST_ALLOWED_TRANSITIONS.SUBMITTED).toContain("CANCELLED");
  });

  it("allows completing or cancelling a scheduled request", () => {
    expect(REQUEST_ALLOWED_TRANSITIONS.SCHEDULED).toContain("COMPLETED");
    expect(REQUEST_ALLOWED_TRANSITIONS.SCHEDULED).toContain("CANCELLED");
  });

  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(REQUEST_ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
    expect(REQUEST_ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
  });
});
