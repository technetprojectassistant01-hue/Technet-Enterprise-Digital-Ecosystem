import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS } from "./projects";

describe("project status transitions", () => {
  it("allows the documented forward transitions", () => {
    expect(ALLOWED_TRANSITIONS.QUOTED).toContain("APPROVED");
    expect(ALLOWED_TRANSITIONS.APPROVED).toContain("IN_PROGRESS");
    expect(ALLOWED_TRANSITIONS.IN_PROGRESS).toContain("COMPLETED");
    expect(ALLOWED_TRANSITIONS.COMPLETED).toContain("CLOSED");
  });

  it("allows cancelling from any non-terminal status", () => {
    for (const status of ["QUOTED", "APPROVED", "IN_PROGRESS", "ON_HOLD"] as const) {
      expect(ALLOWED_TRANSITIONS[status]).toContain("CANCELLED");
    }
  });

  it("treats CLOSED and CANCELLED as terminal", () => {
    expect(ALLOWED_TRANSITIONS.CLOSED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("rejects skipping states backward", () => {
    expect(ALLOWED_TRANSITIONS.IN_PROGRESS).not.toContain("QUOTED");
    expect(ALLOWED_TRANSITIONS.COMPLETED).not.toContain("IN_PROGRESS");
  });
});
