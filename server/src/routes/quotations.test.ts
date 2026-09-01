import { describe, expect, it } from "vitest";
import {
  validateItems,
  parseProductLine,
  parseValidityDays,
  parseAvailability,
  validatePaymentTermsLines,
} from "./quotations";

describe("validateItems", () => {
  it("rejects a non-array or empty list", () => {
    expect(validateItems(undefined)).toHaveProperty("error");
    expect(validateItems([])).toHaveProperty("error");
  });

  it("rejects a line with a blank description", () => {
    expect(validateItems([{ description: "  ", quantity: 1, unitPrice: 10 }])).toHaveProperty("error");
  });

  it("rejects a non-positive quantity or unit price", () => {
    expect(validateItems([{ description: "AC unit", quantity: 0, unitPrice: 10 }])).toHaveProperty("error");
    expect(validateItems([{ description: "AC unit", quantity: 1, unitPrice: -5 }])).toHaveProperty("error");
  });

  it("rejects a string quantity - Number.isFinite does not coerce", () => {
    expect(validateItems([{ description: "AC unit", quantity: "2", unitPrice: 10 }])).toHaveProperty("error");
  });

  it("accepts a well-formed list", () => {
    const result = validateItems([{ description: "AC unit", quantity: 2, unitPrice: 1500 }]);
    expect(result).toEqual({ items: [{ description: "AC unit", quantity: 2, unitPrice: 1500 }] });
  });
});

describe("parseProductLine", () => {
  it("treats empty / null / undefined as 'not specified'", () => {
    expect(parseProductLine(undefined)).toEqual({ productLine: null });
    expect(parseProductLine(null)).toEqual({ productLine: null });
    expect(parseProductLine("")).toEqual({ productLine: null });
  });

  it("accepts a value from the fixed list", () => {
    expect(parseProductLine("Air Conditioning Unit")).toEqual({ productLine: "Air Conditioning Unit" });
  });

  it("rejects anything not in the list", () => {
    expect(parseProductLine("Aircon")).toHaveProperty("error");
    expect(parseProductLine(42)).toHaveProperty("error");
  });
});

describe("parseValidityDays", () => {
  it("defaults to 15 when omitted", () => {
    expect(parseValidityDays(undefined)).toEqual({ validityDays: 15 });
    expect(parseValidityDays("")).toEqual({ validityDays: 15 });
  });

  it("accepts a positive number and truncates fractions", () => {
    expect(parseValidityDays(30)).toEqual({ validityDays: 30 });
    expect(parseValidityDays(30.9)).toEqual({ validityDays: 30 });
  });

  it("rejects zero, negatives, and non-numbers", () => {
    expect(parseValidityDays(0)).toHaveProperty("error");
    expect(parseValidityDays(-1)).toHaveProperty("error");
    expect(parseValidityDays("30")).toHaveProperty("error");
    expect(parseValidityDays(Number.NaN)).toHaveProperty("error");
  });
});

describe("parseAvailability", () => {
  it("returns nulls when no status is given (service/install quotation)", () => {
    expect(parseAvailability({})).toEqual({ availabilityStatus: null, orderDays: null });
    expect(parseAvailability({ availabilityStatus: "" })).toEqual({ availabilityStatus: null, orderDays: null });
  });

  it("rejects an unknown status", () => {
    expect(parseAvailability({ availabilityStatus: "BACKORDERED" })).toHaveProperty("error");
  });

  it("accepts IN_STOCK and clears orderDays", () => {
    expect(parseAvailability({ availabilityStatus: "IN_STOCK", orderDays: 5 })).toEqual({
      availabilityStatus: "IN_STOCK",
      orderDays: null,
    });
  });

  it("requires a positive orderDays for ORDER_PENDING and truncates it", () => {
    expect(parseAvailability({ availabilityStatus: "ORDER_PENDING" })).toHaveProperty("error");
    expect(parseAvailability({ availabilityStatus: "ORDER_PENDING", orderDays: 0 })).toHaveProperty("error");
    expect(parseAvailability({ availabilityStatus: "ORDER_PENDING", orderDays: "7" })).toHaveProperty("error");
    expect(parseAvailability({ availabilityStatus: "ORDER_PENDING", orderDays: 7.8 })).toEqual({
      availabilityStatus: "ORDER_PENDING",
      orderDays: 7,
    });
  });
});

describe("validatePaymentTermsLines", () => {
  it("rejects a non-array or empty list", () => {
    expect(validatePaymentTermsLines(undefined)).toHaveProperty("error");
    expect(validatePaymentTermsLines([])).toHaveProperty("error");
  });

  it("rejects a blank label", () => {
    expect(validatePaymentTermsLines([{ label: "   ", percentage: 100 }])).toHaveProperty("error");
  });

  it("rejects a non-positive percentage", () => {
    expect(validatePaymentTermsLines([{ label: "Confirmation", percentage: 0 }])).toHaveProperty("error");
  });

  it("rejects a string percentage - the bug that shipped once (CLAUDE.md §9)", () => {
    expect(validatePaymentTermsLines([{ label: "Confirmation", percentage: "100" }])).toHaveProperty("error");
  });

  it("rejects lines that do not sum to 100", () => {
    expect(
      validatePaymentTermsLines([
        { label: "Confirmation", percentage: 60 },
        { label: "Delivery", percentage: 30 },
      ]),
    ).toHaveProperty("error");
  });

  it("accepts a single 100% line", () => {
    expect(validatePaymentTermsLines([{ label: "Confirmation", percentage: 100 }])).toEqual({
      lines: [{ label: "Confirmation", percentage: 100 }],
    });
  });

  it("accepts a 60/40/20-style split and trims the labels", () => {
    const result = validatePaymentTermsLines([
      { label: " Confirmation ", percentage: 60 },
      { label: "Progress", percentage: 20 },
      { label: "Completion", percentage: 20 },
    ]);
    expect(result).toEqual({
      lines: [
        { label: "Confirmation", percentage: 60 },
        { label: "Progress", percentage: 20 },
        { label: "Completion", percentage: 20 },
      ],
    });
  });

  it("tolerates floating-point drift on thirds (33.34 + 33.33 + 33.33)", () => {
    expect(
      validatePaymentTermsLines([
        { label: "A", percentage: 33.34 },
        { label: "B", percentage: 33.33 },
        { label: "C", percentage: 33.33 },
      ]),
    ).not.toHaveProperty("error");
  });
});
