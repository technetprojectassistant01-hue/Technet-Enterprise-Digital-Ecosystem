import { describe, expect, it } from "vitest";
import { formatMaterialNumber, isLowStock, parseIssueLines, parseMaterialFields, parseQuantity, parseStockChange } from "./materials";

describe("parseQuantity", () => {
  it("accepts numbers and typed text with up to 2 decimals", () => {
    expect(parseQuantity(3)).toBe(3);
    expect(parseQuantity(" 1.5 ")).toBe(1.5);
    expect(parseQuantity("0.29")).toBe(0.29);
  });

  it("refuses zero unless allowed, negatives, junk and 3 decimals", () => {
    expect(parseQuantity(0)).toBeNull();
    expect(parseQuantity(0, { allowZero: true })).toBe(0);
    expect(parseQuantity(-1, { allowZero: true })).toBeNull();
    expect(parseQuantity("two")).toBeNull();
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity(1.234)).toBeNull();
  });
});

describe("parseMaterialFields", () => {
  it("needs a name, defaults the unit and minimum, and takes opening stock on create", () => {
    expect(parseMaterialFields({ name: " " })).toEqual({ error: "Give the material a name" });
    expect(parseMaterialFields({ name: "Silicone glue", reference: "SIL-300", quantity: "12" }, { withQuantity: true })).toEqual({
      data: { name: "Silicone glue", reference: "SIL-300", category: null, unit: "unit", minStock: 0, location: null, notes: null, quantity: 12 },
    });
  });

  it("never sets stock on edit, and refuses a bad minimum", () => {
    const parsed = parseMaterialFields({ name: "Tape", quantity: 99 });
    expect("data" in parsed && "quantity" in parsed.data).toBe(false);
    expect(parseMaterialFields({ name: "Tape", minStock: "-2" })).toHaveProperty("error");
  });
});

describe("parseStockChange", () => {
  it("adds a positive delivery or sets a counted stock", () => {
    expect(parseStockChange({ type: "IN", quantity: "5", reason: "Delivery" })).toEqual({ data: { type: "IN", quantity: 5, reason: "Delivery" } });
    expect(parseStockChange({ type: "ADJUST", quantity: 0 })).toEqual({ data: { type: "ADJUST", count: 0, reason: null } });
  });

  it("refuses an empty delivery or an unknown change", () => {
    expect(parseStockChange({ type: "IN", quantity: 0 })).toHaveProperty("error");
    expect(parseStockChange({ type: "OUT", quantity: 1 })).toEqual({ error: "Unknown stock change" });
  });
});

describe("parseIssueLines", () => {
  const requested = new Map([
    ["a", 2],
    ["b", 1.5],
  ]);

  it("matches lines to materials, defaults the quantity, and issues unmentioned lines as asked", () => {
    expect(parseIssueLines([{ itemId: "a", materialId: "m1", quantity: "" }], requested)).toEqual({
      lines: [
        { itemId: "a", materialId: "m1", quantity: 2 },
        { itemId: "b", materialId: null, quantity: 1.5 },
      ],
    });
  });

  it("refuses a line from another request, a duplicate, or a bad quantity", () => {
    expect(parseIssueLines([{ itemId: "zzz" }], requested)).toHaveProperty("error");
    expect(parseIssueLines([{ itemId: "a" }, { itemId: "a" }], requested)).toHaveProperty("error");
    expect(parseIssueLines([{ itemId: "a", quantity: 0 }], requested)).toHaveProperty("error");
  });
});

describe("helpers", () => {
  it("numbers materials MT-0001 and spots low stock only when a minimum is set", () => {
    expect(formatMaterialNumber(12)).toBe("MT-0012");
    expect(isLowStock(3, 5)).toBe(true);
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(0, 0)).toBe(false);
  });
});
