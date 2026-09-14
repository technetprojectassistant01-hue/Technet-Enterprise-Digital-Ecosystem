import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { notifyRoles, notifyUser } from "../lib/notifications";
import { claimRequest, releaseRequest } from "../lib/idempotency";

const router = Router();

const STATUSES = ["SUBMITTED", "APPROVED", "REJECTED"] as const;
type Status = (typeof STATUSES)[number];

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };
const USER_SELECT = { id: true, name: true, email: true };
const INCLUDE = {
  submittedBy: { select: USER_SELECT },
  reviewedBy: { select: USER_SELECT },
  technicians: { include: { employee: { select: EMPLOYEE_SELECT } } },
  workOrders: { include: { workOrder: { select: { id: true, workOrderNumber: true, title: true } } } },
  // Never the bytes — those are served one at a time by GET /:id/photos/:photoId.
  photos: { select: { id: true, fileName: true, mimeType: true }, orderBy: { createdAt: "asc" as const } },
};

/** Photos a daily report can carry. The client shrinks them before upload; this is the hard limit. */
export const MAX_DAILY_REPORT_PHOTOS = 3;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"];

function decodeDataUrl(input: unknown): { buffer: Buffer; mimeType: string } | null {
  if (typeof input !== "string" || !input) return null;
  const match = /^data:([^;]+);base64,(.+)$/.exec(input);
  if (!match) return null;
  const [, mimeType, data] = match;
  return { buffer: Buffer.from(data, "base64"), mimeType };
}

type ParsedPhoto = { buffer: Buffer; mimeType: string; fileName: string };

/** Validates the optional `photos` array sent with a new report. */
export function parseDailyReportPhotos(input: unknown): { photos: ParsedPhoto[] } | { error: string } {
  if (input === undefined || input === null) return { photos: [] };
  if (!Array.isArray(input)) return { error: "photos must be a list" };
  if (input.length > MAX_DAILY_REPORT_PHOTOS) return { error: `You can attach up to ${MAX_DAILY_REPORT_PHOTOS} photos` };
  const photos: ParsedPhoto[] = [];
  for (const item of input) {
    const { fileData, fileName } = (item ?? {}) as { fileData?: unknown; fileName?: unknown };
    const file = decodeDataUrl(fileData);
    if (!file) return { error: "Each photo needs its image data" };
    if (!ALLOWED_PHOTO_MIME.includes(file.mimeType)) return { error: "Photos must be JPEG, PNG, WEBP or HEIC images" };
    if (file.buffer.byteLength > MAX_PHOTO_BYTES) return { error: "Each photo must be 5MB or smaller" };
    const name = typeof fileName === "string" && fileName.trim() ? fileName.trim().slice(0, 200) : "photo.jpg";
    photos.push({ ...file, fileName: name });
  }
  return { photos };
}

router.use(requireAuth);

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[0]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

router.get("/", async (req, res) => {
  const { status, from, to } = req.query;

  const where: Prisma.DailyWorkReportWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as Status)) {
    where.status = status as Status;
  }
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = fromDate;
    if (toDate) where.date.lte = new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  const dailyWorkReports = await prisma.dailyWorkReport.findMany({
    where,
    include: INCLUDE,
    orderBy: { date: "desc" },
  });
  res.json({ dailyWorkReports });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const dailyWorkReport = await prisma.dailyWorkReport.findUnique({ where: { id }, include: INCLUDE });
  if (!dailyWorkReport) return res.status(404).json({ error: "Daily work report not found" });
  res.json({ dailyWorkReport });
});

router.get("/:id/photos/:photoId", async (req, res) => {
  const { id, photoId } = req.params as { id: string; photoId: string };
  const photo = await prisma.dailyWorkReportPhoto.findFirst({ where: { id: photoId, dailyWorkReportId: id } });
  if (!photo) return res.status(404).json({ error: "Photo not found" });
  res.setHeader("Content-Type", photo.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${photo.fileName.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.send(Buffer.from(photo.data));
});

router.post("/", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const { date, summary, hours, technicianIds, workOrderIds } = req.body ?? {};

  if (!date || Number.isNaN(new Date(date).getTime())) {
    return res.status(400).json({ error: "A valid date is required" });
  }
  if (typeof summary !== "string" || !summary.trim()) {
    return res.status(400).json({ error: "Summary is required" });
  }
  if (hours !== undefined && hours !== null && (!Number.isFinite(hours) || hours < 0)) {
    return res.status(400).json({ error: "Hours must be a non-negative number" });
  }

  const parsedPhotos = parseDailyReportPhotos((req.body as { photos?: unknown })?.photos);
  if ("error" in parsedPhotos) return res.status(400).json({ error: parsedPhotos.error });

  const techIds = Array.isArray(technicianIds) ? (technicianIds as string[]).filter((v) => typeof v === "string") : [];
  const woIds = Array.isArray(workOrderIds) ? (workOrderIds as string[]).filter((v) => typeof v === "string") : [];

  // A daily report queued offline is replayed on reconnect; skip it if the first attempt landed.
  const clientRequestId = (req.body as { clientRequestId?: unknown })?.clientRequestId;
  if (!(await claimRequest(clientRequestId, "daily-report"))) {
    return res.status(200).json({ deduped: true });
  }

  try {
    const dailyWorkReport = await prisma.dailyWorkReport.create({
      data: {
        date: new Date(date),
        summary: summary.trim(),
        hours: hours !== undefined && hours !== null ? hours : null,
        submittedById: req.user!.sub,
        technicians: { create: techIds.map((employeeId) => ({ employeeId })) },
        workOrders: { create: woIds.map((workOrderId) => ({ workOrderId })) },
        photos: {
          create: parsedPhotos.photos.map((p) => ({
            data: p.buffer as unknown as Uint8Array<ArrayBuffer>,
            mimeType: p.mimeType,
            fileName: p.fileName,
          })),
        },
      },
      include: INCLUDE,
    });
    const reportDate = dailyWorkReport.date.toISOString().slice(0, 10);
    await notifyRoles(OPS_MANAGE_ROLES, "DAILY_REPORT_SUBMITTED", `Daily report for ${reportDate} needs review`, {
      link: `/dashboard/operations/daily-reports/${dailyWorkReport.id}`,
    });
    res.status(201).json({ dailyWorkReport });
  } catch (err) {
    await releaseRequest(clientRequestId);
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Technician or work order not found" });
    throw err;
  }
});

async function review(id: string, reviewerId: string, toStatus: "APPROVED" | "REJECTED", note?: string) {
  const existing = await prisma.dailyWorkReport.findUnique({ where: { id } });
  if (!existing) return { error: "not_found" as const };
  if (existing.status !== "SUBMITTED") {
    return { error: "invalid_transition" as const, fromStatus: existing.status };
  }

  const dailyWorkReport = await prisma.dailyWorkReport.update({
    where: { id },
    data: { status: toStatus, reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: note || null },
    include: INCLUDE,
  });
  const reportDate = dailyWorkReport.date.toISOString().slice(0, 10);
  await notifyUser(
    dailyWorkReport.submittedById,
    toStatus === "APPROVED" ? "DAILY_REPORT_APPROVED" : "DAILY_REPORT_REJECTED",
    `Daily report for ${reportDate} was ${toStatus === "APPROVED" ? "approved" : "rejected"}`,
    { link: `/dashboard/operations/daily-reports/${dailyWorkReport.id}` },
  );
  return { dailyWorkReport };
}

router.post("/:id/approve", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};
  const result = await review(id, req.user!.sub, "APPROVED", typeof note === "string" ? note : undefined);
  if (result.error === "not_found") return res.status(404).json({ error: "Daily work report not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot approve a report in ${result.fromStatus} status` });
  }
  res.json({ dailyWorkReport: result.dailyWorkReport });
});

router.post("/:id/reject", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};
  const result = await review(id, req.user!.sub, "REJECTED", typeof note === "string" ? note : undefined);
  if (result.error === "not_found") return res.status(404).json({ error: "Daily work report not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot reject a report in ${result.fromStatus} status` });
  }
  res.json({ dailyWorkReport: result.dailyWorkReport });
});

router.delete("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.dailyWorkReport.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Daily work report not found" });
    throw err;
  }
});

export default router;
