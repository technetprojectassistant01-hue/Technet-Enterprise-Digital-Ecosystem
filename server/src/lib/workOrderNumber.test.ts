import { describe, expect, it } from "vitest";
import { nextWorkOrderNumber } from "./workOrderNumber";

describe("nextWorkOrderNumber", () => {
  it("starts at 100 when nothing exists yet", () => {
    expect(nextWorkOrderNumber([])).toBe("100");
  });

  it("continues from the highest number on file", () => {
    expect(nextWorkOrderNumber(["100", "101"])).toBe("102");
  });

  it("does not reissue a deleted number in the middle of the range", () => {
    expect(nextWorkOrderNumber(["100", "102"])).toBe("103");
  });

  it("ignores numbers that are not plain digits", () => {
    expect(nextWorkOrderNumber(["WO-7", "101", "draft"])).toBe("102");
  });

  it("never goes below the company's first number", () => {
    expect(nextWorkOrderNumber(["7"])).toBe("100");
  });
});
