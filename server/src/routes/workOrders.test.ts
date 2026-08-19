import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS } from "./workOrders";

describe("work order status transitions", () => {
  it("allows the documented forward transitions", () => {
    expect(ALLOWED_TRANSITIONS.SCHEDULED).toContain("IN_PROGRESS");
    expect(ALLOWED_TRANSITIONS.IN_PROGRESS).toContain("WAITING_FOR_PARTS");
    expect(ALLOWED_TRANSITIONS.WAITING_FOR_PARTS).toContain("IN_PROGRESS");
    expect(ALLOWED_TRANSITIONS.IN_PROGRESS).toContain("COMPLETED");
    expect(ALLOWED_TRANSITIONS.COMPLETED).toContain("REOPENED");
    expect(ALLOWED_TRANSITIONS.REOPENED).toContain("IN_PROGRESS");
  });

  it("allows cancelling from any non-terminal status", () => {
    for (const status of ["SCHEDULED", "IN_PROGRESS", "WAITING_FOR_PARTS", "REOPENED"] as const) {
      expect(ALLOWED_TRANSITIONS[status]).toContain("CANCELLED");
    }
  });

  it("treats CANCELLED as terminal", () => {
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("only allows COMPLETED to move to REOPENED", () => {
    expect(ALLOWED_TRANSITIONS.COMPLETED).toEqual(["REOPENED"]);
  });

  it("rejects skipping states", () => {
    expect(ALLOWED_TRANSITIONS.SCHEDULED).not.toContain("COMPLETED");
    expect(ALLOWED_TRANSITIONS.SCHEDULED).not.toContain("WAITING_FOR_PARTS");
    expect(ALLOWED_TRANSITIONS.IN_PROGRESS).not.toContain("REOPENED");
  });
});
