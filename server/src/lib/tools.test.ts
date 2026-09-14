import { describe, expect, it } from "vitest";
import { formatToolNumber, formatToolRequestNumber, parseToolIds, statusAfterReturn } from "./tools";

describe("tool numbers", () => {
  it("pads to four digits", () => {
    expect(formatToolNumber(7)).toBe("TL-0007");
    expect(formatToolRequestNumber(123)).toBe("TR-0123");
  });
});

describe("statusAfterReturn", () => {
  it("puts good and fair tools back on the shelf", () => {
    expect(statusAfterReturn("GOOD")).toBe("AVAILABLE");
    expect(statusAfterReturn("FAIR")).toBe("AVAILABLE");
  });
  it("sends damaged tools to repair", () => {
    expect(statusAfterReturn("DAMAGED")).toBe("UNDER_REPAIR");
  });
});

describe("parseToolIds", () => {
  it("dedupes a valid list", () => {
    expect(parseToolIds(["a", "b", "a"])).toEqual(["a", "b"]);
  });
  it("rejects empty or malformed input", () => {
    expect(parseToolIds([])).toBeNull();
    expect(parseToolIds("a")).toBeNull();
    expect(parseToolIds(["a", 3])).toBeNull();
    expect(parseToolIds(["", "b"])).toBeNull();
  });
});
