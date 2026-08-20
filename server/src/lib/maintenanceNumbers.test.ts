import { describe, expect, it } from "vitest";
import { formatAssetNumber, formatContractNumber, formatRequestNumber } from "./maintenanceNumbers";

describe("formatAssetNumber", () => {
  it("zero-pads small sequence numbers to 6 digits", () => {
    expect(formatAssetNumber(1)).toBe("AST-000001");
  });

  it("does not truncate sequence numbers beyond 6 digits", () => {
    expect(formatAssetNumber(1000000)).toBe("AST-1000000");
  });
});

describe("formatContractNumber", () => {
  it("zero-pads small sequence numbers to 6 digits", () => {
    expect(formatContractNumber(1)).toBe("MC-000001");
  });
});

describe("formatRequestNumber", () => {
  it("zero-pads small sequence numbers to 6 digits", () => {
    expect(formatRequestNumber(1)).toBe("MR-000001");
  });
});
