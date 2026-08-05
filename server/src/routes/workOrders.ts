import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { formatInterventionNumber } from "../lib/interventionNumber";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";

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

const STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

const CUSTOMER_SELECT = { id: true, name: true, company: true, address: true };
const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { status, customerId, technicianId } = req.query;

  const where: Prisma.WorkOrderWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as Status)) {
    where.status = status as Status;
  }
  if (typeof customerId === "string" && customerId) {
    where.customerId = customerId;
  }
  if (typeof technicianId === "string" && technicianId) {
    where.technicians = { some: { employeeId: technicianId } };
  }

  const workOrders = await prisma.workOrder.findMany({
    where,
    include: {
      customer: { select: CUSTOMER_SELECT },
      technicians: { include: { employee: { select: EMPLOYEE_SELECT } } },
    },
    orderBy: { scheduledDate: "desc" },
  });
  res.json({ workOrders });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      project: { select: { id: true, name: true } },
      technicians: { include: { employee: { select: EMPLOYEE_SELECT } } },
      interventionReports: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sequenceNumber: true,
          status: true,
          workCompleted: true,
          createdAt: true,
        },
      },
      siteAttendance: {
        include: { employee: { select: EMPLOYEE_SELECT } },
        orderBy: { checkInAt: "desc" },
      },
    },
  });
  if (!workOrder) return res.status(404).json({ error: "Work order not found" });
  res.json({
    workOrder: {
      ...workOrder,
      interventionReports: workOrder.interventionReports.map((r) => ({
        ...r,
        interventionNumber: formatInterventionNumber(r.sequenceNumber),
      })),
    },
  });
});

router.post("/", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const { customerId, projectId, workOrderNumber, title, jobCategory, description, scheduledDate, technicianIds } =
    req.body ?? {};

  if (typeof customerId !== "string" || !customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }
  if (typeof workOrderNumber !== "string" || !workOrderNumber.trim()) {
    return res.status(400).json({ error: "Work order number is required" });
  }
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  if (!JOB_CATEGORIES.includes(jobCategory)) {
    return res.status(400).json({ error: "Invalid job category" });
  }
  if (!scheduledDate || Number.isNaN(new Date(scheduledDate).getTime())) {
    return res.status(400).json({ error: "A valid scheduled date is required" });
  }
  const techIds = Array.isArray(technicianIds) ? (technicianIds as string[]).filter((v) => typeof v === "string") : [];

  try {
    const workOrder = await prisma.workOrder.create({
      data: {
        customerId,
        projectId: typeof projectId === "string" && projectId ? projectId : null,
        workOrderNumber: workOrderNumber.trim(),
        title: title.trim(),
        jobCategory: jobCategory as JobCategory,
        description: typeof description === "string" && description.trim() ? description.trim() : null,
        scheduledDate: new Date(scheduledDate),
        createdById: req.user!.sub,
        technicians: { create: techIds.map((employeeId) => ({ employeeId })) },
      },
      include: {
        customer: { select: CUSTOMER_SELECT },
        technicians: { include: { employee: { select: EMPLOYEE_SELECT } } },
      },
    });
    res.status(201).json({ workOrder });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "A work order with that number already exists" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer, project, or technician not found" });
    throw err;
  }
});

router.patch("/:id", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { title, description, scheduledDate, status, technicianIds } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const data: Prisma.WorkOrderUpdateInput = {};
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if (description !== undefined) data.description = description || null;
  if (scheduledDate !== undefined) data.scheduledDate = new Date(scheduledDate);
  if (status !== undefined) data.status = status as Status;

  try {
    if (Array.isArray(technicianIds)) {
      const techIds = (technicianIds as string[]).filter((v) => typeof v === "string");
      await prisma.workOrderTechnician.deleteMany({ where: { workOrderId: id } });
      data.technicians = { create: techIds.map((employeeId) => ({ employeeId })) };
    }

    const workOrder = await prisma.workOrder.update({
      where: { id },
      data,
      include: {
        customer: { select: CUSTOMER_SELECT },
        technicians: { include: { employee: { select: EMPLOYEE_SELECT } } },
      },
    });
    res.json({ workOrder });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Work order not found" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Technician not found" });
    throw err;
  }
});

function parseCoords(body: unknown): { lat: number; lng: number } | null {
  const { lat, lng } = (body as { lat?: unknown; lng?: unknown }) ?? {};
  if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
  if (typeof lng !== "number" || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function parseNote(body: unknown): string | null {
  const note = (body as { note?: unknown } | null)?.note;
  return typeof note === "string" && note.trim() ? note.trim().slice(0, 200) : null;
}

router.post("/:id/check-in", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const workOrderId = req.params.id as string;
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });
  const note = parseNote(req.body);
  if (!note) return res.status(400).json({ error: "A location note is required to check in" });

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const assignment = await prisma.workOrderTechnician.findUnique({
    where: { workOrderId_employeeId: { workOrderId, employeeId: employee.id } },
  });
  if (!assignment) return res.status(403).json({ error: "You are not assigned to this work order" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { workOrderId, employeeId: employee.id, checkOutAt: null },
  });
  if (openVisit) return res.status(400).json({ error: "You are already checked in to this work order" });

  const siteAttendance = await prisma.siteAttendance.create({
    data: {
      workOrderId,
      employeeId: employee.id,
      checkInLat: coords.lat,
      checkInLng: coords.lng,
      checkInNote: note,
    },
    include: { employee: { select: EMPLOYEE_SELECT } },
  });
  res.status(201).json({ siteAttendance });
});

router.post("/:id/check-out", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const workOrderId = req.params.id as string;
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { workOrderId, employeeId: employee.id, checkOutAt: null },
  });
  if (!openVisit) return res.status(404).json({ error: "You are not currently checked in to this work order" });

  const siteAttendance = await prisma.siteAttendance.update({
    where: { id: openVisit.id },
    data: {
      checkOutAt: new Date(),
      checkOutLat: coords.lat,
      checkOutLng: coords.lng,
      checkOutNote: parseNote(req.body),
    },
    include: { employee: { select: EMPLOYEE_SELECT } },
  });
  res.json({ siteAttendance });
});

router.delete("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.workOrder.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Work order not found" });
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ error: "Work order has intervention reports and cannot be deleted" });
    }
    throw err;
  }
});

export default router;
