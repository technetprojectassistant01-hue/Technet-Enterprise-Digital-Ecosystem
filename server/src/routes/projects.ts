import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isUniqueConstraintError, isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";

const router = Router();

const STATUSES = ["QUOTED", "APPROVED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CLOSED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  QUOTED: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

const CATEGORIES = ["ELECTRICAL", "ELV_SECURITY", "MECHANICAL", "PLUMBING", "SAFETY", "OTHER"] as const;

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { search, status } = req.query;

  const where: Prisma.ProjectWhereInput = {};
  if (typeof search === "string" && search.trim()) {
    where.name = { contains: search, mode: "insensitive" };
  }
  if (typeof status === "string" && STATUSES.includes(status as Status)) {
    where.status = status as Status;
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, company: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ projects });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      assignments: { include: { employee: { select: { id: true, firstName: true, lastName: true, position: true } } } },
      invoices: { orderBy: { issueDate: "desc" } },
      expenses: { orderBy: { date: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 20, include: { changedBy: { select: { id: true, name: true, email: true } } } },
    },
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  res.json({ project });
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { name, customerId, contractId, description, serviceCategory, budget, startDate, endDate, managerId } =
    req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (serviceCategory !== undefined && !CATEGORIES.includes(serviceCategory)) {
    return res.status(400).json({ error: "Invalid service category" });
  }

  try {
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        customerId: typeof customerId === "string" && customerId ? customerId : null,
        contractId: typeof contractId === "string" && contractId ? contractId : null,
        description: typeof description === "string" && description ? description : null,
        serviceCategory: serviceCategory || "OTHER",
        budget: budget === undefined || budget === null || budget === "" ? null : budget,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        managerId: typeof managerId === "string" && managerId ? managerId : null,
      },
    });
    res.status(201).json({ project });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) {
      return res.status(400).json({ error: "Customer, contract, or manager not found" });
    }
    throw err;
  }
});

router.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { name, customerId, contractId, description, serviceCategory, budget, startDate, endDate, managerId } =
    req.body ?? {};

  if (serviceCategory !== undefined && !CATEGORIES.includes(serviceCategory)) {
    return res.status(400).json({ error: "Invalid service category" });
  }

  const data: Prisma.ProjectUpdateInput = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (customerId !== undefined) data.customer = customerId ? { connect: { id: customerId } } : { disconnect: true };
  if (contractId !== undefined) data.contract = contractId ? { connect: { id: contractId } } : { disconnect: true };
  if (description !== undefined) data.description = description || null;
  if (serviceCategory !== undefined) data.serviceCategory = serviceCategory;
  if (budget !== undefined) data.budget = budget === null || budget === "" ? null : budget;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
  if (managerId !== undefined) data.manager = managerId ? { connect: { id: managerId } } : { disconnect: true };

  try {
    const project = await prisma.project.update({ where: { id }, data });
    res.json({ project });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Project not found" });
    if (isForeignKeyConstraintError(err)) {
      return res.status(400).json({ error: "Customer, contract, or manager not found" });
    }
    throw err;
  }
});

router.post("/:id/status", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { status, note } = req.body ?? {};

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const fromStatus = project.status as Status;
  if (!ALLOWED_TRANSITIONS[fromStatus].includes(status)) {
    return res.status(400).json({ error: `Cannot move a project from ${fromStatus} to ${status}` });
  }

  const [, updated] = await prisma.$transaction([
    prisma.projectStatusHistory.create({
      data: {
        projectId: id,
        fromStatus,
        toStatus: status as Status,
        changedById: req.user!.sub,
        note: typeof note === "string" && note ? note : null,
      },
    }),
    prisma.project.update({ where: { id }, data: { status: status as Status } }),
  ]);

  res.json({ project: updated });
});

router.post("/:id/assignments", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { employeeId, roleOnProject } = req.body ?? {};

  if (typeof employeeId !== "string" || !employeeId) {
    return res.status(400).json({ error: "employeeId is required" });
  }

  try {
    const assignment = await prisma.projectAssignment.create({
      data: {
        projectId: id,
        employeeId,
        roleOnProject: typeof roleOnProject === "string" && roleOnProject ? roleOnProject : null,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true, position: true } } },
    });
    res.status(201).json({ assignment });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "Employee already assigned to this project" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Project or employee not found" });
    throw err;
  }
});

router.delete("/:id/assignments/:employeeId", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { id, employeeId } = req.params as { id: string; employeeId: string };
  try {
    await prisma.projectAssignment.delete({
      where: { projectId_employeeId: { projectId: id, employeeId } },
    });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Assignment not found" });
    throw err;
  }
});

export default router;
