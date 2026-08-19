import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { formatInterventionNumber } from "../lib/interventionNumber";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { notifyRoles, notifyUser } from "../lib/notifications";

const router = Router();

const JOB_CATEGORIES = [
  "INSTALLATION",
  "START_UP_COMMISSIONING",
  "OUTDOOR_REPAIR",
  "WORKSHOP_REPAIR",
  "SERVICING",
  "MAINTENANCE_CONTRACT",
  "SURVEY",
  "OTHERS",
] as const;
type JobCategory = (typeof JOB_CATEGORIES)[number];

const WORK_TYPES = ["ELECTRICAL", "ELV_SECURITY", "MECHANICAL", "PLUMBING", "SAFETY", "OTHER"] as const;
type WorkType = (typeof WORK_TYPES)[number];

const WARRANTY_STATUSES = ["YES", "NO", "UNKNOWN"] as const;
type WarrantyStatus = (typeof WARRANTY_STATUSES)[number];

const STATUSES = ["SUBMITTED", "APPROVED", "REJECTED"] as const;
type Status = (typeof STATUSES)[number];

const REMINDER_INTERVALS = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL"] as const;
type ReminderInterval = (typeof REMINDER_INTERVALS)[number];
const REMINDER_MONTHS: Record<ReminderInterval, number> = { MONTHLY: 1, QUARTERLY: 3, SEMI_ANNUAL: 6 };

const PHOTO_KINDS = ["EQUIPMENT", "WORK_DONE", "BEFORE", "AFTER"] as const;
type PhotoKind = (typeof PHOTO_KINDS)[number];

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const ALLOWED_PHOTO_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };
const USER_SELECT = { id: true, name: true, email: true };
const CUSTOMER_SELECT = { id: true, name: true, company: true, address: true };

// Bytes columns (signatureData/attachmentData, and photo bytes in their own
// table) are deliberately excluded from every list/detail response — they're
// only ever streamed via the dedicated binary endpoints below, so JSON
// payloads stay small.
const DETAIL_SELECT = {
  id: true,
  sequenceNumber: true,
  customerId: true,
  customer: { select: CUSTOMER_SELECT },
  workOrderId: true,
  date: true,
  contactPerson: true,
  contactPhone: true,
  contactEmail: true,
  jobCategory: true,
  workType: true,
  workTypeOther: true,
  equipment: true,
  make: true,
  model: true,
  serialNo: true,
  dateInstalled: true,
  natureOfIntervention: true,
  actionTaken: true,
  workCompleted: true,
  incompleteDetails: true,
  timeIn: true,
  timeOut: true,
  warrantyStatus: true,
  technicianReport: true,
  materialsUsed: true,
  comments: true,
  additionalInfo: true,
  reminderInterval: true,
  nextReminderAt: true,
  signedByName: true,
  signedAt: true,
  attachmentFileName: true,
  attachmentMimeType: true,
  status: true,
  createdById: true,
  reviewedById: true,
  reviewedAt: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
  workOrder: {
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
    },
  },
  createdBy: { select: USER_SELECT },
  reviewedBy: { select: USER_SELECT },
  technicians: { include: { employee: { select: EMPLOYEE_SELECT } } },
  photos: { select: { id: true, kind: true, fileName: true, mimeType: true, createdAt: true } },
} satisfies Prisma.InterventionReportSelect;

function decodeDataUrl(input: unknown): { buffer: Buffer; mimeType: string } | null {
  if (typeof input !== "string" || !input) return null;
  const match = /^data:([^;]+);base64,(.+)$/.exec(input);
  if (!match) return null;
  const [, mimeType, data] = match;
  return { buffer: Buffer.from(data, "base64"), mimeType };
}

function withInterventionNumber<T extends { sequenceNumber: number }>(report: T) {
  return { ...report, interventionNumber: formatInterventionNumber(report.sequenceNumber) };
}

router.use(requireAuth);

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

router.get("/", async (req, res) => {
  const { status, workOrderId, customerId, dueRemindersOnly, jobCategory, workType, from, to } = req.query;

  const where: Prisma.InterventionReportWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as Status)) {
    where.status = status as Status;
  }
  if (typeof workOrderId === "string" && workOrderId) {
    where.workOrderId = workOrderId;
  }
  if (typeof customerId === "string" && customerId) {
    where.customerId = customerId;
  }
  if (dueRemindersOnly === "true") {
    where.nextReminderAt = { lte: new Date() };
  }
  if (typeof jobCategory === "string" && JOB_CATEGORIES.includes(jobCategory as JobCategory)) {
    where.jobCategory = jobCategory as JobCategory;
  }
  if (typeof workType === "string" && WORK_TYPES.includes(workType as WorkType)) {
    where.workType = workType as WorkType;
  }
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = fromDate;
    if (toDate) where.date.lte = new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  const interventionReports = await prisma.interventionReport.findMany({
    where,
    select: DETAIL_SELECT,
    orderBy: { date: "desc" },
  });
  res.json({ interventionReports: interventionReports.map(withInterventionNumber) });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const interventionReport = await prisma.interventionReport.findUnique({ where: { id }, select: DETAIL_SELECT });
  if (!interventionReport) return res.status(404).json({ error: "Intervention report not found" });
  res.json({ interventionReport: withInterventionNumber(interventionReport) });
});

router.get("/:id/signature", async (req, res) => {
  const id = req.params.id as string;
  const report = await prisma.interventionReport.findUnique({ where: { id }, select: { signatureData: true } });
  if (!report || !report.signatureData) return res.status(404).json({ error: "No signature on file" });
  res.setHeader("Content-Type", "image/png");
  res.send(Buffer.from(report.signatureData));
});

router.get("/:id/attachment", async (req, res) => {
  const id = req.params.id as string;
  const report = await prisma.interventionReport.findUnique({
    where: { id },
    select: { attachmentData: true, attachmentMimeType: true, attachmentFileName: true },
  });
  if (!report || !report.attachmentData) return res.status(404).json({ error: "No attachment on file" });
  res.setHeader("Content-Type", report.attachmentMimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${report.attachmentFileName || "attachment"}"`);
  res.send(Buffer.from(report.attachmentData));
});

router.get("/:id/photos", async (req, res) => {
  const id = req.params.id as string;
  const photos = await prisma.interventionReportPhoto.findMany({
    where: { interventionReportId: id },
    select: { id: true, kind: true, fileName: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ photos });
});

router.get("/:id/photos/:photoId", async (req, res) => {
  const { id, photoId } = req.params as { id: string; photoId: string };
  const photo = await prisma.interventionReportPhoto.findFirst({
    where: { id: photoId, interventionReportId: id },
    select: { data: true, mimeType: true, fileName: true },
  });
  if (!photo) return res.status(404).json({ error: "Photo not found" });
  res.setHeader("Content-Type", photo.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${photo.fileName}"`);
  res.send(Buffer.from(photo.data));
});

router.post("/:id/photos", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { kind, fileData, fileName } = req.body ?? {};

  if (!PHOTO_KINDS.includes(kind)) {
    return res.status(400).json({ error: "Invalid photo kind" });
  }
  const file = decodeDataUrl(fileData);
  if (!file) return res.status(400).json({ error: "A photo file is required" });
  if (file.buffer.byteLength > MAX_ATTACHMENT_BYTES) {
    return res.status(400).json({ error: "Photo must be 8MB or smaller" });
  }
  if (!ALLOWED_PHOTO_MIME.includes(file.mimeType)) {
    return res.status(400).json({ error: "Photo must be a JPEG, PNG, WEBP, or HEIC image" });
  }
  if (typeof fileName !== "string" || !fileName.trim()) {
    return res.status(400).json({ error: "fileName is required" });
  }

  try {
    const photo = await prisma.interventionReportPhoto.create({
      data: {
        interventionReportId: id,
        kind: kind as PhotoKind,
        data: file.buffer as unknown as Uint8Array<ArrayBuffer>,
        mimeType: file.mimeType,
        fileName: fileName.trim(),
      },
      select: { id: true, kind: true, fileName: true, mimeType: true, createdAt: true },
    });
    res.status(201).json({ photo });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(404).json({ error: "Intervention report not found" });
    throw err;
  }
});

router.delete("/:id/photos/:photoId", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const { id, photoId } = req.params as { id: string; photoId: string };
  const result = await prisma.interventionReportPhoto.deleteMany({ where: { id: photoId, interventionReportId: id } });
  if (result.count === 0) return res.status(404).json({ error: "Photo not found" });
  res.status(204).end();
});

router.post("/", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const {
    customerId,
    workOrderId,
    date,
    contactPerson,
    contactPhone,
    contactEmail,
    jobCategory,
    workType,
    workTypeOther,
    equipment,
    make,
    model,
    serialNo,
    dateInstalled,
    natureOfIntervention,
    actionTaken,
    workCompleted,
    incompleteDetails,
    timeIn,
    timeOut,
    warrantyStatus,
    technicianReport,
    materialsUsed,
    comments,
    additionalInfo,
    technicianIds,
    signedByName,
    signatureData,
    attachmentData,
    attachmentFileName,
  } = req.body ?? {};

  if (typeof customerId !== "string" || !customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }
  if (!JOB_CATEGORIES.includes(jobCategory)) {
    return res.status(400).json({ error: "Invalid job category" });
  }
  if (!WORK_TYPES.includes(workType)) {
    return res.status(400).json({ error: "Invalid work type" });
  }
  if (typeof natureOfIntervention !== "string" || !natureOfIntervention.trim()) {
    return res.status(400).json({ error: "Nature of intervention is required" });
  }
  if (typeof actionTaken !== "string" || !actionTaken.trim()) {
    return res.status(400).json({ error: "Action taken is required" });
  }
  if (warrantyStatus !== undefined && warrantyStatus !== null && !WARRANTY_STATUSES.includes(warrantyStatus)) {
    return res.status(400).json({ error: "Invalid warranty status" });
  }

  let signature: { buffer: Buffer; mimeType: string } | null = null;
  if (signatureData) {
    signature = decodeDataUrl(signatureData);
    if (!signature) return res.status(400).json({ error: "Invalid signature data" });
  }

  let attachment: { buffer: Buffer; mimeType: string } | null = null;
  if (attachmentData) {
    attachment = decodeDataUrl(attachmentData);
    if (!attachment) return res.status(400).json({ error: "Invalid attachment data" });
    if (attachment.buffer.byteLength > MAX_ATTACHMENT_BYTES) {
      return res.status(400).json({ error: "Attachment must be 8MB or smaller" });
    }
    if (!ALLOWED_ATTACHMENT_MIME.includes(attachment.mimeType)) {
      return res.status(400).json({ error: "Attachment must be a photo (JPEG/PNG/WEBP/HEIC) or PDF" });
    }
  }

  const techIds = Array.isArray(technicianIds) ? (technicianIds as string[]).filter((v) => typeof v === "string") : [];

  try {
    const created = await prisma.interventionReport.create({
      data: {
        customerId,
        workOrderId: typeof workOrderId === "string" && workOrderId ? workOrderId : null,
        date: date ? new Date(date) : new Date(),
        contactPerson: typeof contactPerson === "string" && contactPerson ? contactPerson : null,
        contactPhone: typeof contactPhone === "string" && contactPhone ? contactPhone : null,
        contactEmail: typeof contactEmail === "string" && contactEmail ? contactEmail : null,
        jobCategory: jobCategory as JobCategory,
        workType: workType as WorkType,
        workTypeOther: typeof workTypeOther === "string" && workTypeOther.trim() ? workTypeOther.trim() : null,
        equipment: typeof equipment === "string" && equipment ? equipment : null,
        make: typeof make === "string" && make ? make : null,
        model: typeof model === "string" && model ? model : null,
        serialNo: typeof serialNo === "string" && serialNo ? serialNo : null,
        dateInstalled: dateInstalled ? new Date(dateInstalled) : null,
        natureOfIntervention: natureOfIntervention.trim(),
        actionTaken: actionTaken.trim(),
        workCompleted: workCompleted !== false,
        incompleteDetails: typeof incompleteDetails === "string" && incompleteDetails ? incompleteDetails : null,
        timeIn: typeof timeIn === "string" && timeIn ? timeIn : null,
        timeOut: typeof timeOut === "string" && timeOut ? timeOut : null,
        warrantyStatus: (warrantyStatus as WarrantyStatus) || null,
        technicianReport: typeof technicianReport === "string" && technicianReport ? technicianReport : null,
        materialsUsed: typeof materialsUsed === "string" && materialsUsed ? materialsUsed : null,
        comments: typeof comments === "string" && comments ? comments : null,
        additionalInfo: typeof additionalInfo === "string" && additionalInfo ? additionalInfo : null,
        signedByName: typeof signedByName === "string" && signedByName ? signedByName : null,
        signedAt: signature ? new Date() : null,
        signatureData: signature ? (signature.buffer as unknown as Uint8Array<ArrayBuffer>) : null,
        attachmentData: attachment ? (attachment.buffer as unknown as Uint8Array<ArrayBuffer>) : null,
        attachmentMimeType: attachment ? attachment.mimeType : null,
        attachmentFileName: attachment && typeof attachmentFileName === "string" ? attachmentFileName : null,
        createdById: req.user!.sub,
        technicians: { create: techIds.map((employeeId) => ({ employeeId })) },
      },
      select: { id: true, workOrderId: true, workCompleted: true },
    });

    if (created.workOrderId && created.workCompleted) {
      await prisma.workOrder.update({ where: { id: created.workOrderId }, data: { status: "COMPLETED" } });
    }

    const interventionReport = await prisma.interventionReport.findUnique({
      where: { id: created.id },
      select: DETAIL_SELECT,
    });
    const withNumber = withInterventionNumber(interventionReport!);
    await notifyRoles(OPS_MANAGE_ROLES, "INTERVENTION_REPORT_SUBMITTED", `Intervention report ${withNumber.interventionNumber} needs review`, {
      link: `/dashboard/operations/intervention-reports/${withNumber.id}`,
    });
    res.status(201).json({ interventionReport: withNumber });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer, work order, or technician not found" });
    throw err;
  }
});

router.patch("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { workOrderId } = req.body ?? {};

  const data: Prisma.InterventionReportUpdateInput = {};
  if (workOrderId !== undefined) {
    data.workOrder = workOrderId ? { connect: { id: workOrderId } } : { disconnect: true };
  }

  try {
    await prisma.interventionReport.update({ where: { id }, data });
    const interventionReport = await prisma.interventionReport.findUnique({ where: { id }, select: DETAIL_SELECT });
    res.json({ interventionReport: withInterventionNumber(interventionReport!) });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Intervention report not found" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Work order not found" });
    throw err;
  }
});

router.post("/:id/reminder", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { interval } = req.body ?? {};

  if (interval !== null && !REMINDER_INTERVALS.includes(interval)) {
    return res.status(400).json({ error: "Invalid reminder interval" });
  }

  const nextReminderAt = interval
    ? new Date(new Date().setMonth(new Date().getMonth() + REMINDER_MONTHS[interval as ReminderInterval]))
    : null;

  try {
    await prisma.interventionReport.update({
      where: { id },
      data: { reminderInterval: interval, nextReminderAt },
    });
    const interventionReport = await prisma.interventionReport.findUnique({ where: { id }, select: DETAIL_SELECT });
    res.json({ interventionReport: withInterventionNumber(interventionReport!) });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Intervention report not found" });
    throw err;
  }
});

async function review(id: string, reviewerId: string, toStatus: "APPROVED" | "REJECTED", note?: string) {
  const existing = await prisma.interventionReport.findUnique({ where: { id } });
  if (!existing) return { error: "not_found" as const };
  if (existing.status !== "SUBMITTED") {
    return { error: "invalid_transition" as const, fromStatus: existing.status };
  }

  await prisma.interventionReport.update({
    where: { id },
    data: { status: toStatus, reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: note || null },
  });
  const interventionReport = await prisma.interventionReport.findUnique({ where: { id }, select: DETAIL_SELECT });
  const withNumber = withInterventionNumber(interventionReport!);
  await notifyUser(
    existing.createdById,
    toStatus === "APPROVED" ? "INTERVENTION_REPORT_APPROVED" : "INTERVENTION_REPORT_REJECTED",
    `Intervention report ${withNumber.interventionNumber} was ${toStatus === "APPROVED" ? "approved" : "rejected"}`,
    { link: `/dashboard/operations/intervention-reports/${withNumber.id}` },
  );
  return { interventionReport: withNumber };
}

router.post("/:id/approve", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};
  const result = await review(id, req.user!.sub, "APPROVED", typeof note === "string" ? note : undefined);
  if (result.error === "not_found") return res.status(404).json({ error: "Intervention report not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot approve a report in ${result.fromStatus} status` });
  }
  res.json({ interventionReport: result.interventionReport });
});

router.post("/:id/reject", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};
  const result = await review(id, req.user!.sub, "REJECTED", typeof note === "string" ? note : undefined);
  if (result.error === "not_found") return res.status(404).json({ error: "Intervention report not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot reject a report in ${result.fromStatus} status` });
  }
  res.json({ interventionReport: result.interventionReport });
});

router.delete("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.interventionReport.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Intervention report not found" });
    throw err;
  }
});

export default router;
