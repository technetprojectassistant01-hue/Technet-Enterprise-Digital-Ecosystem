import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { formatInterventionNumber } from "../lib/interventionNumber";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";
import { geocodeAddress } from "../lib/geocode";
import { notifyEmployee, notifyRoles } from "../lib/notifications";
import { mauritiusDay } from "../lib/overtime";
import { generateWorkOrderNumber } from "../lib/workOrderNumber";

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

const STATUSES = ["SCHEDULED", "IN_PROGRESS", "WAITING_FOR_PARTS", "COMPLETED", "REOPENED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_PARTS", "COMPLETED", "CANCELLED"],
  WAITING_FOR_PARTS: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};


const CUSTOMER_SELECT = { id: true, name: true, company: true, address: true };
const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };

type SiteLocation = { lat: number; lng: number; address: string };

/**
 * Resolves a typed address/place name to a location via free geocoding. Empty/missing clears the site.
 *
 * Confined to Mauritius. Without that, measured against the real API, "Rose Hill" resolves to Iowa
 * and "Celero Level 5" to Victoria, Australia — a plausible-looking pin on the wrong continent,
 * which is worse than an honest failure. The same constraint is why locationMatch.ts sets it
 * (CLAUDE.md §7b). A timeout keeps a slow third-party lookup from holding the save open, and a
 * network error is reported as a failed lookup rather than a 500.
 */
async function resolveSiteLocation(raw: unknown): Promise<{ ok: true; value: SiteLocation | null } | { ok: false }> {
  if (typeof raw !== "string" || !raw.trim()) return { ok: true, value: null };
  try {
    const result = await geocodeAddress(raw.trim(), { countryCode: "mu", timeoutMs: 8000 });
    if (!result) return { ok: false };
    return { ok: true, value: { lat: result.lat, lng: result.lng, address: result.displayName } };
  } catch {
    return { ok: false };
  }
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

/**
 * The jobs assigned to the signed-in technician for one day — what they see on the landing page
 * right where they check in, so a day's work arrives with them rather than having to be hunted
 * for in the full Work Orders list (which shows everybody's).
 *
 * `carriedOver` is anything still open from an earlier day. Without it a job that slipped past
 * its scheduled date would silently vanish from the technician's view while still being open,
 * which is exactly the lifecycle drift that made auto-detection unusable (CLAUDE.md §7a).
 */
router.get("/my-day", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub }, select: { id: true } });
  if (!employee) return res.status(403).json({ error: "No employee record is linked to your account" });

  // Mauritius is UTC+4 year round, and scheduledDate is stored at UTC midnight of the chosen day.
  const day = parseDateOnly(req.query.date) ?? parseDateOnly(mauritiusDay(new Date()));
  if (!day) return res.status(400).json({ error: "Invalid date" });
  const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);

  const OPEN: Status[] = ["SCHEDULED", "IN_PROGRESS", "WAITING_FOR_PARTS", "REOPENED"];
  const workOrders = await prisma.workOrder.findMany({
    where: {
      technicians: { some: { employeeId: employee.id } },
      OR: [
        { scheduledDate: { gte: day, lt: nextDay } },
        { scheduledDate: { lt: day }, status: { in: OPEN } },
      ],
    },
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      description: true,
      jobCategory: true,
      status: true,
      scheduledDate: true,
      siteAddress: true,
      siteLat: true,
      siteLng: true,
      customer: { select: { id: true, name: true, company: true, phone: true, address: true } },
      technicians: { include: { employee: { select: EMPLOYEE_SELECT } } },
    },
    orderBy: { scheduledDate: "asc" },
  });

  const isToday = (w: (typeof workOrders)[number]) => w.scheduledDate >= day && w.scheduledDate < nextDay;
  res.json({
    date: day.toISOString().slice(0, 10),
    today: workOrders.filter(isToday),
    carriedOver: workOrders.filter((w) => !isToday(w)),
  });
});

/** Manager-facing feed for the Field Operations view: who's in the field right now, plus recent history. */
// "Who is in the field right now", for Field Operations. Site attendance no longer links to a
// work order (CLAUDE.md §7a), so this is a team-attendance feed: open sessions, plus the last
// 50 closed ones.
router.get("/site-tracking", requireRole(...OPS_MANAGE_ROLES), async (_req, res) => {
  const [current, recentlyCompleted] = await Promise.all([
    prisma.siteAttendance.findMany({
      where: { checkOutAt: null },
      include: {
        employee: { select: EMPLOYEE_SELECT },
        verifications: { orderBy: { checkedAt: "desc" } },
      },
      orderBy: { checkInAt: "desc" },
    }),
    prisma.siteAttendance.findMany({
      where: { checkOutAt: { not: null } },
      include: {
        employee: { select: EMPLOYEE_SELECT },
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
  const { customerId, projectId, title, jobCategory, description, scheduledDate, technicianIds, siteQuery } =
    req.body ?? {};

  if (typeof customerId !== "string" || !customerId) {
    return res.status(400).json({ error: "customerId is required" });
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
      error: "Couldn't find that place in Mauritius. Use an area, street or town — leave off a floor, unit or company name (e.g. \"Ebene\" or \"Pailles\", not \"Celero Ltd, Level 5\"). You can also leave the site blank and add it later.",
    });
  }
  const techIds = Array.isArray(technicianIds) ? (technicianIds as string[]).filter((v) => typeof v === "string") : [];

  // The number is assigned here, not typed by a manager. A unique-constraint clash means two
  // saves landed together, so take the next one and try again - the same retry loop
  // generateEmployeeCode and generateQuotationNumber sit behind.
  for (let attempt = 0; attempt < 5; attempt++) {
  try {
    const workOrder = await prisma.workOrder.create({
      data: {
        customerId,
        projectId: typeof projectId === "string" && projectId ? projectId : null,
        workOrderNumber: await generateWorkOrderNumber(),
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
    await Promise.all(
      techIds.map((employeeId) =>
        notifyEmployee(employeeId, "WORK_ORDER_ASSIGNED", `Assigned to work order ${workOrder.workOrderNumber}`, {
          link: `/dashboard/operations/work-orders/${workOrder.id}`,
        }),
      ),
    );
    return res.status(201).json({ workOrder });
  } catch (err) {
    if (isUniqueConstraintError(err)) continue;
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer, project, or technician not found" });
    throw err;
  }
  }
  return res.status(409).json({ error: "Couldn't assign a work order number. Try again." });
});

router.patch("/:id", requireRole(...OPS_SUBMIT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { customerId, title, jobCategory, description, scheduledDate, status, technicianIds, siteQuery } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  if (jobCategory !== undefined && !JOB_CATEGORIES.includes(jobCategory)) {
    return res.status(400).json({ error: "Invalid job category" });
  }
  if (status !== undefined) {
    const current = await prisma.workOrder.findUnique({ where: { id }, select: { status: true } });
    if (!current) return res.status(404).json({ error: "Work order not found" });
    if (!ALLOWED_TRANSITIONS[current.status].includes(status)) {
      return res.status(400).json({ error: `Cannot move a work order from ${current.status} to ${status}` });
    }
  }
  if (siteQuery !== undefined && !(OPS_MANAGE_ROLES as readonly string[]).includes(req.user!.role)) {
    return res.status(403).json({ error: "Only operations management can set the site location" });
  }

  const data: Prisma.WorkOrderUpdateInput = {};
  if (typeof customerId === "string" && customerId) data.customer = { connect: { id: customerId } };
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if (jobCategory !== undefined) data.jobCategory = jobCategory as JobCategory;
  if (description !== undefined) data.description = description || null;
  if (scheduledDate !== undefined) data.scheduledDate = new Date(scheduledDate);
  if (status !== undefined) data.status = status as Status;
  if (siteQuery !== undefined) {
    const resolvedSite = await resolveSiteLocation(siteQuery);
    if (!resolvedSite.ok) {
      return res.status(400).json({
      error: "Couldn't find that place in Mauritius. Use an area, street or town — leave off a floor, unit or company name (e.g. \"Ebene\" or \"Pailles\", not \"Celero Ltd, Level 5\"). You can also leave the site blank and add it later.",
    });
    }
    data.siteLat = resolvedSite.value?.lat ?? null;
    data.siteLng = resolvedSite.value?.lng ?? null;
    data.siteAddress = resolvedSite.value?.address ?? null;
  }

  let newlyAssignedTechIds: string[] = [];

  try {
    if (Array.isArray(technicianIds)) {
      const techIds = (technicianIds as string[]).filter((v) => typeof v === "string");
      const existing = await prisma.workOrderTechnician.findMany({ where: { workOrderId: id }, select: { employeeId: true } });
      const existingIds = new Set(existing.map((t) => t.employeeId));
      newlyAssignedTechIds = techIds.filter((employeeId) => !existingIds.has(employeeId));
      // Clear and re-add inside the same nested write, so the whole swap rides on the update's
      // own transaction. A separate deleteMany beforehand is not rolled back when the update
      // then fails - a single bad technician id would strip every technician off the work order
      // and still return an error. Same deleteMany-plus-create shape quotations.ts uses for its
      // line items and payment-terms lines.
      data.technicians = { deleteMany: {}, create: techIds.map((employeeId) => ({ employeeId })) };
    }

    const workOrder = await prisma.workOrder.update({
      where: { id },
      data,
      include: {
        customer: { select: CUSTOMER_SELECT },
        technicians: { include: { employee: { select: EMPLOYEE_SELECT } } },
      },
    });
    await Promise.all(
      newlyAssignedTechIds.map((employeeId) =>
        notifyEmployee(employeeId, "WORK_ORDER_ASSIGNED", `Assigned to work order ${workOrder.workOrderNumber}`, {
          link: `/dashboard/operations/work-orders/${workOrder.id}`,
        }),
      ),
    );
    // Only the statuses a manager actually needs to act on — not IN_PROGRESS, which is routine.
    if (status === "WAITING_FOR_PARTS" || status === "COMPLETED" || status === "CANCELLED") {
      await notifyRoles(
        OPS_MANAGE_ROLES,
        "WORK_ORDER_STATUS_CHANGED",
        `Work order ${workOrder.workOrderNumber} is now ${status.replace("_", " ")}`,
        { link: `/dashboard/operations/work-orders/${workOrder.id}` },
      );
    }
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
