import { describe, expect, it } from "vitest";
import { MAX_DAILY_REPORT_PHOTOS, parseDailyReportPhotos } from "./dailyReports";

const jpeg = (bytes = 10) => `data:image/jpeg;base64,${Buffer.alloc(bytes, 1).toString("base64")}`;

describe("daily report photos", () => {
  it("treats no photos as an empty list", () => {
    expect(parseDailyReportPhotos(undefined)).toEqual({ photos: [] });
  });

  it("accepts up to the maximum", () => {
    const result = parseDailyReportPhotos(Array.from({ length: MAX_DAILY_REPORT_PHOTOS }, (_, i) => ({ fileData: jpeg(), fileName: `p${i}.jpg` })));
    expect("photos" in result && result.photos).toHaveLength(3);
  });

  it("refuses more than 3", () => {
    const result = parseDailyReportPhotos(Array.from({ length: 4 }, () => ({ fileData: jpeg(), fileName: "p.jpg" })));
    expect(result).toEqual({ error: "You can attach up to 3 photos" });
  });

  it("refuses non-images and oversized files", () => {
    expect(parseDailyReportPhotos([{ fileData: "data:application/pdf;base64,AAAA", fileName: "a.pdf" }])).toHaveProperty("error");
    expect(parseDailyReportPhotos([{ fileData: jpeg(5 * 1024 * 1024 + 1), fileName: "big.jpg" }])).toHaveProperty("error");
  });
});
