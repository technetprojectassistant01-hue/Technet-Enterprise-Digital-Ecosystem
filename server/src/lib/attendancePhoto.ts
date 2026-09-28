import { prisma } from "./prisma";

/**
 * The check-in photo (verified-attendance spec 2026-09-26, section 1). Required by default; set
 * ATTENDANCE_PHOTO_REQUIRED=false on Render to switch it off - an env var rather than an in-app
 * setting, chosen with the user 2026-09-28 (the same pattern as ATTENDANCE_AUDIT_ENABLED; the app
 * has no settings table, see CLAUDE.md §10d).
 */
export function isPhotoRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ATTENDANCE_PHOTO_REQUIRED?.trim().toLowerCase() !== "false";
}

/**
 * Photos are deleted after this many days; the attendance record itself (times, GPS) stays. Chosen
 * with the user 2026-09-28: at roughly 50 KB a photo this keeps the Neon database flat (~30 MB)
 * instead of growing ~300 MB a year.
 */
export const PHOTO_RETENTION_DAYS = 90;

/**
 * The client shrinks the photo to ~50 KB before sending (client/src/lib/imageResize.ts). This is
 * the hard limit for when it can't - e.g. a format the browser couldn't re-encode.
 */
export const MAX_ATTENDANCE_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

export type ParsedAttendancePhoto = { buffer: Buffer; mimeType: string };

/**
 * `photo` is a base64 data URL, sent inline in the check-in body so a check-in and its photo are
 * one offline-outbox item and one idempotent request - the same approach as daily report photos.
 * Absent is `{ photo: null }`; whether that's allowed is the caller's decision.
 */
export function parseAttendancePhoto(input: unknown): { photo: ParsedAttendancePhoto | null } | { error: string } {
  if (input === undefined || input === null || input === "") return { photo: null };
  if (typeof input !== "string") return { error: "The check-in photo must be an image" };
  const match = /^data:([^;]+);base64,(.+)$/.exec(input);
  if (!match) return { error: "The check-in photo must be an image" };
  const [, mimeType, data] = match;
  if (!ALLOWED_MIME.includes(mimeType)) return { error: "The check-in photo must be a JPEG, PNG or WEBP image" };
  const buffer = Buffer.from(data, "base64");
  if (buffer.byteLength === 0) return { error: "The check-in photo is empty" };
  if (buffer.byteLength > MAX_ATTENDANCE_PHOTO_BYTES) return { error: "The check-in photo is too large" };
  return { photo: { buffer, mimeType } };
}

/** Deletes check-in photos past the retention period. Returns how many were removed. */
export async function purgeExpiredAttendancePhotos(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.siteAttendancePhoto.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
