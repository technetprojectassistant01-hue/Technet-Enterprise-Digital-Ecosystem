import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { formatAssetNumber, formatContractNumber, formatRequestNumber } from "../lib/maintenanceNumbers";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";

const router = Router();

const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

/** Every valid status a maintenance schedule (visit) can move to from its current status. */
export const SCHEDULE_ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  SCHEDULED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };
const ASSET_SELECT = {
  id: true,
  sequenceNumber: true,
  name: true,
  customer: { select: { id: true, name: true, company: true } },
};
const CONTRACT_SELECT = { id: true, sequenceNumber: true, asset: { select: ASSET_SELECT } };
const REQUEST_SELECT = { id: true, sequenceNumber: true, description: true, priority: true, asset: { select: ASSET_SELECT } };

const DETAIL_INCLUDE = {
  technicians: { include: { employee: { select: EMPLOYEE_SELECT } } },
  contract: { select: CONTRACT_SELECT },
  request: { select: REQUEST_SELECT },
  report: { include: { submittedBy: { select: { id: true, name: true, email: true } }, reviewedBy: { select: { id: true, name: true, email: true } } } },
} satisfies Prisma.MaintenanceScheduleInclude;

function withNumbers<
  T extends {
    contract: { sequenceNumber: number; asset: { sequenceNumber: number } } | null;
    request: { sequenceNumber: number; asset: { sequenceNumber: number } } | null;
  },
>(schedule: T) {
  return {
    ...schedule,
    contract: schedule.contract
      ? {
          ...schedule.contract,
          contractNumber: formatContractNumber(schedule.contract.sequenceNumber),
          asset: { ...schedule.contract.asset, assetNumber: formatAssetNumber(schedule.contract.asset.sequenceNumber) },
        }
      : null,
    request: schedule.request
      ? {
          ...schedule.request,
          requestNumber: formatRequestNumber(schedule.request.sequenceNumber),
          asset: { ...schedule.request.asset, assetNumber: formatAssetNumber(schedule.request.asset.sequenceNumber) },
        }
      : null,
  };
}

router.use(requireAuth);
router.use(requireRole(...OPS_SUBMIT_ROLES));

router.get("/", async (req, res) => {
  const { status, technicianId, contractId } = req.query;

  const where: Prisma.MaintenanceScheduleWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as Status)) {
    where.status = status as Status;
  }
  if (typeof technicianId === "string" && technicianId) {
    where.technicians = { some: { employeeId: technicianId } };
  }
  if (typeof contractId === "string" && contractId) {
    where.contractId = contractId;
  }

  const schedules = await prisma.maintenanceSchedule.findMany({
    where,
    include: DETAIL_INCLUDE,
    orderBy: { scheduledDate: "desc" },
  });
  res.json({ schedules: schedules.map(withNumbers) });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const schedule = await prisma.maintenanceSchedule.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!schedule) return res.status(404).json({ error: "Maintenance schedule not found" });
  res.json({ schedule: withNumbers(schedule) });
});

router.post("/", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const { contractId, scheduledDate, technicianIds } = req.body ?? {};

  if (typeof contractId !== "string" || !contractId) {
    return res.status(400).json({ error: "contractId is required" });
  }
  if (!scheduledDate || Number.isNaN(new Date(scheduledDate).getTime())) {
    return res.status(400).json({ error: "A valid scheduled date is required" });
  }
  const techIds = Array.isArray(technicianIds) ? (technicianIds as string[]).filter((v) => typeof v === "string") : [];

  try {
    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        contractId,
        scheduledDate: new Date(scheduledDate),
        createdById: req.user!.sub,
        technicians: { create: techIds.map((employeeId) => ({ employeeId })) },
      },
      include: DETAIL_INCLUDE,
    });
    res.status(201).json({ schedule: withNumbers(schedule) });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Contract or technician not found" });
    throw err;
  }
});

router.patch("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { scheduledDate, technicianIds } = req.body ?? {};

  const existing = await prisma.maintenanceSchedule.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Maintenance schedule not found" });
  if (existing.status !== "SCHEDULED") {
    return res.status(400).json({ error: `Cannot edit a schedule in ${existing.status} status` });
  }

  const data: Prisma.MaintenanceScheduleUpdateInput = {};
  if (scheduledDate !== undefined) data.scheduledDate = new Date(scheduledDate);

  try {
    if (Array.isArray(technicianIds)) {
      const techIds = (technicianIds as string[]).filter((v) => typeof v === "string");
      await prisma.maintenanceScheduleTechnician.deleteMany({ where: { scheduleId: id } });
      data.technicians = { create: techIds.map((employeeId) => ({ employeeId })) };
    }

    const schedule = await prisma.maintenanceSchedule.update({ where: { id }, data, include: DETAIL_INCLUDE });
    res.json({ schedule: withNumbers(schedule) });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Technician not found" });
    throw err;
  }
});

router.delete("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.maintenanceSchedule.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Maintenance schedule not found" });
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ error: "Schedule has a filed report and cannot be deleted" });
    }
    throw err;
  }
});

router.post("/:id/report", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { remarks, workCompleted, recommendations } = req.body ?? {};

  if (typeof remarks !== "string" || !remarks.trim()) {
    return res.status(400).json({ error: "Remarks are required" });
  }

  const schedule = await prisma.maintenanceSchedule.findUnique({ where: { id } });
  if (!schedule) return res.status(404).json({ error: "Maintenance schedule not found" });
  if (schedule.status !== "SCHEDULED") {
    return res.status(400).json({ error: `Cannot file a report for a schedule in ${schedule.status} status` });
  }

  await prisma.$transaction([
    prisma.maintenanceReport.create({
      data: {
        scheduleId: id,
        remarks: remarks.trim(),
        workCompleted: workCompleted !== false,
        recommendations: typeof recommendations === "string" && recommendations.trim() ? recommendations.trim() : null,
        submittedById: req.user!.sub,
      },
    }),
    prisma.maintenanceSchedule.update({ where: { id }, data: { status: "COMPLETED" } }),
    ...(schedule.requestId
      ? [prisma.maintenanceRequest.update({ where: { id: schedule.requestId }, data: { status: "COMPLETED" } })]
      : []),
  ]);

  const updated = await prisma.maintenanceSchedule.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  res.status(201).json({ schedule: withNumbers(updated!) });
});

async function reviewReport(scheduleId: string, reviewerId: string, toStatus: "APPROVED" | "REJECTED", note?: string) {
  const schedule = await prisma.maintenanceSchedule.findUnique({ where: { id: scheduleId }, include: { report: true } });
  if (!schedule || !schedule.report) return { error: "not_found" as const };
  if (schedule.report.status !== "SUBMITTED") {
    return { error: "invalid_transition" as const, fromStatus: schedule.report.status };
  }

  await prisma.maintenanceReport.update({
    where: { scheduleId },
    data: { status: toStatus, reviewedById: reviewerId, reviewedAt: new Date(), reviewNote: note || null },
  });
  const updated = await prisma.maintenanceSchedule.findUnique({ where: { id: scheduleId }, include: DETAIL_INCLUDE });
  return { schedule: withNumbers(updated!) };
}

router.post("/:id/report/approve", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};
  const result = await reviewReport(id, req.user!.sub, "APPROVED", typeof note === "string" ? note : undefined);
  if (result.error === "not_found") return res.status(404).json({ error: "Maintenance report not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot approve a report in ${result.fromStatus} status` });
  }
  res.json({ schedule: result.schedule });
});

router.post("/:id/report/reject", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};
  const result = await reviewReport(id, req.user!.sub, "REJECTED", typeof note === "string" ? note : undefined);
  if (result.error === "not_found") return res.status(404).json({ error: "Maintenance report not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot reject a report in ${result.fromStatus} status` });
  }
  res.json({ schedule: result.schedule });
});

export default router;
