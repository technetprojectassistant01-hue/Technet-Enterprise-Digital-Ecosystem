import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { formatAssetNumber, formatRequestNumber } from "../lib/maintenanceNumbers";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { notifyUser } from "../lib/notifications";

const router = Router();

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
type Priority = (typeof PRIORITIES)[number];

const STATUSES = ["SUBMITTED", "SCHEDULED", "COMPLETED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

/** Every valid status a maintenance request can move to from its current status. */
export const REQUEST_ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  SUBMITTED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const ASSET_SELECT = {
  id: true,
  sequenceNumber: true,
  name: true,
  customer: { select: { id: true, name: true, company: true } },
};
const REQUESTER_SELECT = { id: true, name: true, email: true };
const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };

function withRequestNumber<T extends { sequenceNumber: number; asset: { sequenceNumber: number } }>(request: T) {
  return {
    ...request,
    requestNumber: formatRequestNumber(request.sequenceNumber),
    asset: { ...request.asset, assetNumber: formatAssetNumber(request.asset.sequenceNumber) },
  };
}

router.use(requireAuth);
router.use(requireRole(...OPS_SUBMIT_ROLES));

router.get("/", async (req, res) => {
  const { status, assetId } = req.query;

  const where: Prisma.MaintenanceRequestWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as Status)) {
    where.status = status as Status;
  }
  if (typeof assetId === "string" && assetId) {
    where.assetId = assetId;
  }

  const requests = await prisma.maintenanceRequest.findMany({
    where,
    include: { asset: { select: ASSET_SELECT }, requestedBy: { select: REQUESTER_SELECT } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ requests: requests.map(withRequestNumber) });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id },
    include: {
      asset: { select: ASSET_SELECT },
      requestedBy: { select: REQUESTER_SELECT },
      schedule: { include: { technicians: { include: { employee: { select: EMPLOYEE_SELECT } } }, report: true } },
    },
  });
  if (!request) return res.status(404).json({ error: "Maintenance request not found" });
  res.json({ request: withRequestNumber(request) });
});

router.post("/", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const { assetId, contractId, description, priority } = req.body ?? {};

  if (typeof assetId !== "string" || !assetId) {
    return res.status(400).json({ error: "assetId is required" });
  }
  if (typeof description !== "string" || !description.trim()) {
    return res.status(400).json({ error: "Description is required" });
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority" });
  }

  try {
    const request = await prisma.maintenanceRequest.create({
      data: {
        assetId,
        contractId: typeof contractId === "string" && contractId ? contractId : null,
        description: description.trim(),
        priority: (priority as Priority) || "MEDIUM",
        requestedById: req.user!.sub,
      },
      include: { asset: { select: ASSET_SELECT }, requestedBy: { select: REQUESTER_SELECT } },
    });
    res.status(201).json({ request: withRequestNumber(request) });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Asset or contract not found" });
    throw err;
  }
});

router.post("/:id/schedule", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { scheduledDate, technicianIds } = req.body ?? {};

  if (!scheduledDate || Number.isNaN(new Date(scheduledDate).getTime())) {
    return res.status(400).json({ error: "A valid scheduled date is required" });
  }
  const techIds = Array.isArray(technicianIds) ? (technicianIds as string[]).filter((v) => typeof v === "string") : [];

  const existing = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Maintenance request not found" });
  if (!REQUEST_ALLOWED_TRANSITIONS[existing.status as Status].includes("SCHEDULED")) {
    return res.status(400).json({ error: `Cannot schedule a request in ${existing.status} status` });
  }

  try {
    await prisma.$transaction([
      prisma.maintenanceSchedule.create({
        data: {
          contractId: existing.contractId,
          requestId: id,
          scheduledDate: new Date(scheduledDate),
          createdById: req.user!.sub,
          technicians: { create: techIds.map((employeeId) => ({ employeeId })) },
        },
      }),
      prisma.maintenanceRequest.update({ where: { id }, data: { status: "SCHEDULED" } }),
    ]);
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        asset: { select: ASSET_SELECT },
        requestedBy: { select: REQUESTER_SELECT },
        schedule: { include: { technicians: { include: { employee: { select: EMPLOYEE_SELECT } } }, report: true } },
      },
    });
    const withNumber = withRequestNumber(request!);
    await notifyUser(existing.requestedById, "MAINTENANCE_REQUEST_SCHEDULED", `Maintenance request ${withNumber.requestNumber} was scheduled`, {
      link: "/dashboard/maintenance/requests",
    });
    res.status(201).json({ request: withNumber });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Technician not found" });
    throw err;
  }
});

router.post("/:id/cancel", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;

  const existing = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Maintenance request not found" });
  if (!REQUEST_ALLOWED_TRANSITIONS[existing.status as Status].includes("CANCELLED")) {
    return res.status(400).json({ error: `Cannot cancel a request in ${existing.status} status` });
  }

  const request = await prisma.maintenanceRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: { asset: { select: ASSET_SELECT }, requestedBy: { select: REQUESTER_SELECT } },
  });
  const withNumber = withRequestNumber(request);
  await notifyUser(existing.requestedById, "MAINTENANCE_REQUEST_CANCELLED", `Maintenance request ${withNumber.requestNumber} was cancelled`, {
    link: "/dashboard/maintenance/requests",
  });
  res.json({ request: withNumber });
});

router.delete("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.maintenanceRequest.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Maintenance request not found" });
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ error: "Request has a linked schedule and cannot be deleted" });
    }
    throw err;
  }
});

export default router;
