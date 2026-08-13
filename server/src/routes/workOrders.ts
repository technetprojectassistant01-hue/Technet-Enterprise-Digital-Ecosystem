import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { formatInterventionNumber } from "../lib/interventionNumber";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { distanceMeters, SITE_GEOFENCE_RADIUS_METERS } from "../lib/geo";

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

const EXIT_REASONS = ["MATERIALS", "ANOTHER_SITE", "SUPERVISOR_INSTRUCTION", "EMERGENCY", "OTHER"] as const;
type ExitReason = (typeof EXIT_REASONS)[number];

const CUSTOMER_SELECT = { id: true, name: true, company: true, address: true };
const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };

/** Parses the "lat, lng" string pasted from Google Maps. Empty/missing clears the site location. */
function parseSiteCoords(raw: unknown): { ok: true; value: { lat: number; lng: number } | null } | { ok: false } {
  if (typeof raw !== "string" || !raw.trim()) return { ok: true, value: null };
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(raw);
  if (!match) return { ok: false };
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false };
  }
  return { ok: true, value: { lat, lng } };
}

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

/** Manager-facing feed for the Field Operations view: who's in the field right now, plus recent history. */
router.get("/site-tracking", requireRole(...OPS_MANAGE_ROLES), async (_req, res) => {
  const WORK_ORDER_SELECT = {
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      siteLat: true,
      siteLng: true,
      customer: { select: CUSTOMER_SELECT },
    },
  } as const;

  const [current, recentlyCompleted] = await Promise.all([
    prisma.siteAttendance.findMany({
      where: { workOrderId: { not: null }, checkOutAt: null },
      include: {
        employee: { select: EMPLOYEE_SELECT },
        workOrder: WORK_ORDER_SELECT,
        verifications: { orderBy: { checkedAt: "desc" } },
      },
      orderBy: { checkInAt: "desc" },
    }),
    prisma.siteAttendance.findMany({
      where: { workOrderId: { not: null }, checkOutAt: { not: null } },
      include: {
        employee: { select: EMPLOYEE_SELECT },
        workOrder: WORK_ORDER_SELECT,
        verifications: { orderBy: { checkedAt: "desc" } },
      },
      orderBy: { checkOutAt: "desc" },
      take: 50,
    }),
  ]);

  res.json({ current, recentlyCompleted });
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
        include: {
          employee: { select: EMPLOYEE_SELECT },
          verifications: { orderBy: { checkedAt: "desc" } },
        },
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
  const { customerId, projectId, workOrderNumber, title, jobCategory, description, scheduledDate, technicianIds, siteCoords } =
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
  const parsedSite = parseSiteCoords(siteCoords);
  if (!parsedSite.ok) {
    return res.status(400).json({ error: "Site coordinates must look like 'lat, lng', e.g. -20.348404, 57.552152" });
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
        siteLat: parsedSite.value?.lat ?? null,
        siteLng: parsedSite.value?.lng ?? null,
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
  const { title, description, scheduledDate, status, technicianIds, siteCoords } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  if (siteCoords !== undefined && !(OPS_MANAGE_ROLES as readonly string[]).includes(req.user!.role)) {
    return res.status(403).json({ error: "Only operations management can set the site location" });
  }

  const data: Prisma.WorkOrderUpdateInput = {};
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if (description !== undefined) data.description = description || null;
  if (scheduledDate !== undefined) data.scheduledDate = new Date(scheduledDate);
  if (status !== undefined) data.status = status as Status;
  if (siteCoords !== undefined) {
    const parsedSite = parseSiteCoords(siteCoords);
    if (!parsedSite.ok) {
      return res.status(400).json({ error: "Site coordinates must look like 'lat, lng', e.g. -20.348404, 57.552152" });
    }
    data.siteLat = parsedSite.value?.lat ?? null;
    data.siteLng = parsedSite.value?.lng ?? null;
  }

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

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { siteLat: true, siteLng: true },
  });
  if (workOrder?.siteLat != null && workOrder.siteLng != null) {
    const distance = distanceMeters(coords.lat, coords.lng, Number(workOrder.siteLat), Number(workOrder.siteLng));
    if (distance > SITE_GEOFENCE_RADIUS_METERS) {
      return res.status(400).json({
        error: `You're about ${Math.round(distance)}m from the assigned site — check-in requires being within ${SITE_GEOFENCE_RADIUS_METERS}m.`,
      });
    }
  }

  const siteAttendance = await prisma.siteAttendance.create({
    data: {
      workOrderId,
      employeeId: employee.id,
      checkInLat: coords.lat,
      checkInLng: coords.lng,
      checkInNote: note,
    },
    include: { employee: { select: EMPLOYEE_SELECT }, verifications: { orderBy: { checkedAt: "desc" } } },
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
    include: { employee: { select: EMPLOYEE_SELECT }, verifications: { orderBy: { checkedAt: "desc" } } },
  });
  res.json({ siteAttendance });
});

/** A periodic (not continuous) re-check of the technician's location during an active work-order session. */
router.post("/:id/verify-location", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const workOrderId = req.params.id as string;
  const coords = parseCoords(req.body);
  if (!coords) return res.status(400).json({ error: "A valid lat and lng are required" });

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { workOrderId, employeeId: employee.id, checkOutAt: null },
  });
  if (!openVisit) return res.status(404).json({ error: "You are not currently checked in to this work order" });

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { siteLat: true, siteLng: true },
  });
  if (workOrder?.siteLat == null || workOrder.siteLng == null) {
    return res.json({ skipped: true });
  }

  const distance = distanceMeters(coords.lat, coords.lng, Number(workOrder.siteLat), Number(workOrder.siteLng));
  const verification = await prisma.siteVerification.create({
    data: {
      siteAttendanceId: openVisit.id,
      lat: coords.lat,
      lng: coords.lng,
      distanceMeters: Math.round(distance),
      status: distance <= SITE_GEOFENCE_RADIUS_METERS ? "ON_SITE" : "OUTSIDE_SITE",
    },
  });
  res.status(201).json({ verification });
});

router.post("/:id/site-exit-reason", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const workOrderId = req.params.id as string;
  const { reason, note } = req.body ?? {};
  if (typeof reason !== "string" || !EXIT_REASONS.includes(reason as ExitReason)) {
    return res.status(400).json({ error: "A valid reason is required" });
  }

  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  const openVisit = await prisma.siteAttendance.findFirst({
    where: { workOrderId, employeeId: employee.id, checkOutAt: null },
  });
  if (!openVisit) return res.status(404).json({ error: "You are not currently checked in to this work order" });

  const pendingExit = await prisma.siteVerification.findFirst({
    where: { siteAttendanceId: openVisit.id, status: "OUTSIDE_SITE", exitReason: null },
    orderBy: { checkedAt: "desc" },
  });
  if (!pendingExit) return res.status(404).json({ error: "No unexplained site departure to update" });

  const verification = await prisma.siteVerification.update({
    where: { id: pendingExit.id },
    data: {
      exitReason: reason as ExitReason,
      exitReasonNote: typeof note === "string" && note.trim() ? note.trim().slice(0, 300) : null,
    },
  });
  res.json({ verification });
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
