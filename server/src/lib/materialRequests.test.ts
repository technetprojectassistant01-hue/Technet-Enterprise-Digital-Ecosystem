import { describe, expect, it } from "vitest";
import { describeMaterialLines, formatMaterialRequestNumber, parseMaterialRequest } from "./materialRequests";

describe("parseMaterialRequest", () => {
  it("accepts lines with description, optional reference and a quantity", () => {
    const parsed = parseMaterialRequest({
      items: [
        { description: " Silicone glue ", reference: "SIL-300", quantity: "2" },
        { description: "Insulation tape", reference: "", quantity: 1.5 },
      ],
      purpose: " Celero level 5 ",
      neededBy: "2026-10-10",
    });
    expect(parsed).toEqual({
      data: {
        purpose: "Celero level 5",
        neededBy: new Date("2026-10-10T00:00:00.000Z"),
        items: [
          { description: "Silicone glue", reference: "SIL-300", quantity: 2 },
          { description: "Insulation tape", reference: null, quantity: 1.5 },
        ],
      },
    });
  });

  it("accepts two-decimal quantities that aren't exact in floating point", () => {
    const parsed = parseMaterialRequest({ items: [{ description: "Cable", quantity: "0.29" }] });
    expect("data" in parsed && parsed.data.items[0].quantity).toBe(0.29);
  });

  it("drops blank lines left at the bottom of the form", () => {
    const parsed = parseMaterialRequest({ items: [{ description: "Screws", quantity: 100 }, { description: "", reference: "", quantity: "" }] });
    expect("data" in parsed && parsed.data.items).toHaveLength(1);
  });

  it("refuses a request with no lines, a line with no description, or a bad quantity", () => {
    expect(parseMaterialRequest({})).toEqual({ error: "Add at least one material" });
    expect(parseMaterialRequest({ items: [{ description: "", reference: "", quantity: "" }] })).toEqual({ error: "Add at least one material" });
    expect(parseMaterialRequest({ items: [{ reference: "X1", quantity: 2 }] })).toEqual({ error: "Line 1: describe the material" });
    expect(parseMaterialRequest({ items: [{ description: "Glue", quantity: 0 }] })).toEqual({ error: "Line 1: enter a quantity above zero" });
    expect(parseMaterialRequest({ items: [{ description: "Glue", quantity: "two" }] })).toEqual({ error: "Line 1: enter a quantity above zero" });
    expect(parseMaterialRequest({ items: [{ description: "Glue", quantity: 1.234 }] })).toEqual({ error: "Line 1: use at most 2 decimals for the quantity" });
  });

  it("refuses an invalid needed-by date", () => {
    expect(parseMaterialRequest({ items: [{ description: "Glue", quantity: 1 }], neededBy: "soon" })).toEqual({ error: "Invalid needed-by date" });
  });
});

describe("formatting", () => {
  it("numbers requests MR-0001", () => {
    expect(formatMaterialRequestNumber(7)).toBe("MR-0007");
  });

  it("describes lines for a notification", () => {
    expect(describeMaterialLines([{ description: "Glue", reference: "SIL-300", quantity: "2.00" }, { description: "Tape", reference: null, quantity: 1 }])).toBe(
      "2 x Glue (SIL-300), 1 x Tape",
    );
  });
});
