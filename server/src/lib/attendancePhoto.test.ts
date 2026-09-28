import { describe, expect, it } from "vitest";
import { isPhotoRequired, MAX_ATTENDANCE_PHOTO_BYTES, parseAttendancePhoto } from "./attendancePhoto";

const dataUrl = (mime: string, bytes: number) => `data:${mime};base64,${Buffer.alloc(bytes, 1).toString("base64")}`;

describe("isPhotoRequired", () => {
  it("is on by default", () => {
    expect(isPhotoRequired({})).toBe(true);
    expect(isPhotoRequired({ ATTENDANCE_PHOTO_REQUIRED: "" })).toBe(true);
    expect(isPhotoRequired({ ATTENDANCE_PHOTO_REQUIRED: "true" })).toBe(true);
  });

  it("is off only for an explicit false", () => {
    expect(isPhotoRequired({ ATTENDANCE_PHOTO_REQUIRED: "false" })).toBe(false);
    expect(isPhotoRequired({ ATTENDANCE_PHOTO_REQUIRED: " FALSE " })).toBe(false);
  });

  it("stays on for anything that isn't clearly false - a typo must not silently switch it off", () => {
    expect(isPhotoRequired({ ATTENDANCE_PHOTO_REQUIRED: "no" })).toBe(true);
    expect(isPhotoRequired({ ATTENDANCE_PHOTO_REQUIRED: "0" })).toBe(true);
  });
});

describe("parseAttendancePhoto", () => {
  it("treats absent as no photo", () => {
    expect(parseAttendancePhoto(undefined)).toEqual({ photo: null });
    expect(parseAttendancePhoto(null)).toEqual({ photo: null });
    expect(parseAttendancePhoto("")).toEqual({ photo: null });
  });

  it("decodes a JPEG data URL", () => {
    const result = parseAttendancePhoto(dataUrl("image/jpeg", 50_000));
    expect("photo" in result && result.photo?.mimeType).toBe("image/jpeg");
    expect("photo" in result && result.photo?.buffer.byteLength).toBe(50_000);
  });

  it("rejects something that isn't a data URL", () => {
    expect(parseAttendancePhoto("hello")).toHaveProperty("error");
    expect(parseAttendancePhoto(123)).toHaveProperty("error");
  });

  it("rejects a non-image type", () => {
    expect(parseAttendancePhoto(dataUrl("application/pdf", 10))).toHaveProperty("error");
  });

  it("rejects an oversized photo", () => {
    expect(parseAttendancePhoto(dataUrl("image/jpeg", MAX_ATTENDANCE_PHOTO_BYTES + 1))).toHaveProperty("error");
  });
});
