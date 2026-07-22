import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { formatInterventionNumber } from "../lib/interventionNumber";

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

const WARRANTY_STATUSES = ["YES", "NO", "UNKNOWN"] as const;
type WarrantyStatus = (typeof WARRANTY_STATUSES)[number];

const STATUSES = ["SUBMITTED", "APPROVED", "REJECTED"] as const;
type Status = (typeof STATUSES)[number];

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };
const USER_SELECT = { id: true, name: true, email: true };

// Bytes columns (signatureData/attachmentData) are deliberately excluded from
// every list/detail response — they're only ever streamed via the dedicated
// /signature and /attachment endpoints below, so JSON payloads stay small.
const DETAIL_SELECT = {
  id: true,
  sequenceNumber: true,
  workOrderId: true,
  date: true,
  contactPerson: true,
  contactPhone: true,
  contactEmail: true,
  jobCategory: true,
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
  comments: true,
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
      customer: { select: { id: true, name: true, company: true, address: true } },
    },
  },
  createdBy: { select: USER_SELECT },
  reviewedBy: { select: USER_SELECT },
  technicians: { include: { employee: { select: EMPLOYEE_SELECT } } },
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

router.get("/", async (req, res) => {
  const { status, workOrderId } = req.query;

  const where: Prisma.InterventionReportWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as Status)) {
    where.status = status as Status;
  }
  if (typeof workOrderId === "string" && workOrderId) {
    where.workOrderId = workOrderId;
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

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const {
    workOrderId,
    date,
    contactPerson,
    contactPhone,
    contactEmail,
    jobCategory,
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
    comments,
    technicianIds,
    signedByName,
    signatureData,
    attachmentData,
    attachmentFileName,
  } = req.body ?? {};

  if (typeof workOrderId !== "string" || !workOrderId) {
    return res.status(400).json({ error: "workOrderId is required" });
  }
  if (!JOB_CATEGORIES.includes(jobCategory)) {
    return res.status(400).json({ error: "Invalid job category" });
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
        workOrderId,
        date: date ? new Date(date) : new Date(),
        contactPerson: typeof contactPerson === "string" && contactPerson ? contactPerson : null,
        contactPhone: typeof contactPhone === "string" && contactPhone ? contactPhone : null,
        contactEmail: typeof contactEmail === "string" && contactEmail ? contactEmail : null,
        jobCategory: jobCategory as JobCategory,
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
        comments: typeof comments === "string" && comments ? comments : null,
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

    if (created.workCompleted) {
      await prisma.workOrder.update({ where: { id: created.workOrderId }, data: { status: "COMPLETED" } });
    }

    const interventionReport = await prisma.interventionReport.findUnique({
      where: { id: created.id },
      select: DETAIL_SELECT,
    });
    res.status(201).json({ interventionReport: withInterventionNumber(interventionReport!) });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Work order or technician not found" });
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
  return { interventionReport: withInterventionNumber(interventionReport!) };
}

router.post("/:id/approve", requireRole("ADMIN"), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};
  const result = await review(id, req.user!.sub, "APPROVED", typeof note === "string" ? note : undefined);
  if (result.error === "not_found") return res.status(404).json({ error: "Intervention report not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot approve a report in ${result.fromStatus} status` });
  }
  res.json({ interventionReport: result.interventionReport });
});

router.post("/:id/reject", requireRole("ADMIN"), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};
  const result = await review(id, req.user!.sub, "REJECTED", typeof note === "string" ? note : undefined);
  if (result.error === "not_found") return res.status(404).json({ error: "Intervention report not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot reject a report in ${result.fromStatus} status` });
  }
  res.json({ interventionReport: result.interventionReport });
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
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
