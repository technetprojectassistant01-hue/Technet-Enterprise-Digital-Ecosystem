import { describe, expect, it } from "vitest";
import { parseClientSentAt, planFinding, type ExistingAnomaly } from "./anomalies";
import type { Finding } from "./anomalyRules";

const now = new Date("2026-09-28T06:00:00Z");
const finding = (key: string, severity: Finding["severity"] = "MEDIUM"): Finding => ({
  type: "LEFT_WORK_AREA",
  severity,
  key,
  details: { distanceMeters: 800 },
});
const anomaly = (over: Partial<ExistingAnomaly> & { keys: string[] }): ExistingAnomaly => ({
  id: over.id ?? "a1",
  status: over.status ?? "OPEN",
  severity: over.severity ?? "MEDIUM",
  occurrenceCount: over.occurrenceCount ?? over.keys.length,
  details: { keys: over.keys, latest: {}, occurrences: over.keys.map((key) => ({ key, recordedAt: now.toISOString() })) },
});

describe("planFinding (de-duplication)", () => {
  it("creates the first anomaly of a type on a visit", () => {
    const plan = planFinding([], finding("audit:1"), now);
    expect(plan.action).toBe("create");
    if (plan.action === "create") expect(plan.details.keys).toEqual(["audit:1"]);
  });

  it("updates the open anomaly and bumps its count for a new occurrence, instead of a second row", () => {
    const plan = planFinding([anomaly({ keys: ["audit:1"] })], finding("audit:2"), now);
    expect(plan.action).toBe("update");
    if (plan.action === "update") {
      expect(plan.occurrenceCount).toBe(2);
      expect(plan.details.keys).toEqual(["audit:1", "audit:2"]);
      expect(plan.details.latest).toEqual({ distanceMeters: 800 });
    }
  });

  it("skips an occurrence it has already counted - re-evaluating a visit is a no-op", () => {
    expect(planFinding([anomaly({ keys: ["audit:1"] })], finding("audit:1"), now)).toEqual({ action: "skip" });
  });

  it("does not re-raise an occurrence a reviewer already decided", () => {
    expect(planFinding([anomaly({ keys: ["audit:1"], status: "FALSE_POSITIVE" })], finding("audit:1"), now)).toEqual({ action: "skip" });
  });

  it("opens a fresh anomaly for a new occurrence once the earlier one was reviewed", () => {
    expect(planFinding([anomaly({ keys: ["audit:1"], status: "DISMISSED" })], finding("audit:2"), now).action).toBe("create");
  });

  it("keeps the higher severity when occurrences differ", () => {
    const plan = planFinding([anomaly({ keys: ["a"], severity: "LOW" })], finding("b", "HIGH"), now);
    expect(plan.action === "update" && plan.severity).toBe("HIGH");
    const kept = planFinding([anomaly({ keys: ["a"], severity: "HIGH" })], finding("b", "LOW"), now);
    expect(kept.action === "update" && kept.severity).toBe("HIGH");
  });

  it("caps the stored occurrence list", () => {
    const keys = Array.from({ length: 20 }, (_, i) => `k${i}`);
    const plan = planFinding([anomaly({ keys })], finding("k20"), now);
    if (plan.action !== "update") throw new Error("expected update");
    expect(plan.details.occurrences).toHaveLength(20);
    expect(plan.details.keys).toHaveLength(21);
    expect(plan.occurrenceCount).toBe(21);
  });
});

describe("parseClientSentAt", () => {
  it("accepts epoch milliseconds and ISO strings", () => {
    expect(parseClientSentAt({ clientSentAt: now.getTime() })?.toISOString()).toBe(now.toISOString());
    expect(parseClientSentAt({ clientSentAt: now.toISOString() })?.toISOString()).toBe(now.toISOString());
  });

  it("returns null when missing or junk", () => {
    expect(parseClientSentAt({})).toBeNull();
    expect(parseClientSentAt({ clientSentAt: "soon" })).toBeNull();
    expect(parseClientSentAt(null)).toBeNull();
  });
});
