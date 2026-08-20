import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { notifyRoles, notifyUser } from "../lib/notifications";

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
};

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

  const techIds = Array.isArray(technicianIds) ? (technicianIds as string[]).filter((v) => typeof v === "string") : [];
  const woIds = Array.isArray(workOrderIds) ? (workOrderIds as string[]).filter((v) => typeof v === "string") : [];

  try {
    const dailyWorkReport = await prisma.dailyWorkReport.create({
      data: {
        date: new Date(date),
        summary: summary.trim(),
        hours: hours !== undefined && hours !== null ? hours : null,
        submittedById: req.user!.sub,
        technicians: { create: techIds.map((employeeId) => ({ employeeId })) },
        workOrders: { create: woIds.map((workOrderId) => ({ workOrderId })) },
      },
      include: INCLUDE,
    });
    const reportDate = dailyWorkReport.date.toISOString().slice(0, 10);
    await notifyRoles(OPS_MANAGE_ROLES, "DAILY_REPORT_SUBMITTED", `Daily report for ${reportDate} needs review`, {
      link: `/dashboard/operations/daily-reports/${dailyWorkReport.id}`,
    });
    res.status(201).json({ dailyWorkReport });
  } catch (err) {
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
