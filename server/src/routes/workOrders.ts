import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { formatInterventionNumber } from "../lib/interventionNumber";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { geocodeAddress } from "../lib/geocode";

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

type SiteLocation = { lat: number; lng: number; address: string };

/** Resolves a typed address/place name to a location via free geocoding. Empty/missing clears the site. */
async function resolveSiteLocation(raw: unknown): Promise<{ ok: true; value: SiteLocation | null } | { ok: false }> {
  if (typeof raw !== "string" || !raw.trim()) return { ok: true, value: null };
  const result = await geocodeAddress(raw.trim());
  if (!result) return { ok: false };
  return { ok: true, value: { lat: result.lat, lng: result.lng, address: result.displayName } };
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
  const { status, customerId, technicianId, from, to } = req.query;

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
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (fromDate || toDate) {
    where.scheduledDate = {};
    if (fromDate) where.scheduledDate.gte = fromDate;
    if (toDate) where.scheduledDate.lte = new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1);
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
  const { customerId, projectId, workOrderNumber, title, jobCategory, description, scheduledDate, technicianIds, siteQuery } =
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
  const resolvedSite = await resolveSiteLocation(siteQuery);
  if (!resolvedSite.ok) {
    return res.status(400).json({
      error: "Couldn't find that location. Use an area, street, or town name, not a company name (e.g. \"Ebene, Mauritius\", not \"Celero Ltd\").",
    });
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
        siteLat: resolvedSite.value?.lat ?? null,
        siteLng: resolvedSite.value?.lng ?? null,
        siteAddress: resolvedSite.value?.address ?? null,
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
  const { title, description, scheduledDate, status, technicianIds, siteQuery } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  if (siteQuery !== undefined && !(OPS_MANAGE_ROLES as readonly string[]).includes(req.user!.role)) {
    return res.status(403).json({ error: "Only operations management can set the site location" });
  }

  const data: Prisma.WorkOrderUpdateInput = {};
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if (description !== undefined) data.description = description || null;
  if (scheduledDate !== undefined) data.scheduledDate = new Date(scheduledDate);
  if (status !== undefined) data.status = status as Status;
  if (siteQuery !== undefined) {
    const resolvedSite = await resolveSiteLocation(siteQuery);
    if (!resolvedSite.ok) {
      return res.status(400).json({
      error: "Couldn't find that location. Use an area, street, or town name, not a company name (e.g. \"Ebene, Mauritius\", not \"Celero Ltd\").",
    });
    }
    data.siteLat = resolvedSite.value?.lat ?? null;
    data.siteLng = resolvedSite.value?.lng ?? null;
    data.siteAddress = resolvedSite.value?.address ?? null;
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
