import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { FINANCE_ROLES, NON_FIELD_ROLES } from "../lib/roles";

const router = Router();
const STATUSES = ["PLANNING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
type ContractStatus = (typeof STATUSES)[number];

router.use(requireAuth, requireRole(...NON_FIELD_ROLES));

router.get("/", async (req, res) => {
  const { status } = req.query;

  const where: Prisma.ContractWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as ContractStatus)) {
    where.status = status as ContractStatus;
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: { customer: { select: { id: true, name: true, company: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ contracts });
});

router.post("/", requireRole(...FINANCE_ROLES), async (req, res) => {
  const { customerId, service, value, status, startDate, endDate } = req.body ?? {};

  if (typeof customerId !== "string" || !customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }
  if (typeof service !== "string" || !service.trim()) {
    return res.status(400).json({ error: "Service is required" });
  }
  if (!Number.isFinite(value) || value <= 0) {
    return res.status(400).json({ error: "Value must be a positive number" });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const contract = await prisma.contract.create({
      data: {
        customerId,
        service: service.trim(),
        value,
        status: (status as ContractStatus) || "PLANNING",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
      include: { customer: { select: { id: true, name: true, company: true } } },
    });
    res.status(201).json({ contract });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer not found" });
    throw err;
  }
});

router.patch("/:id", requireRole(...FINANCE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { service, value, status, startDate, endDate } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    return res.status(400).json({ error: "Value must be a positive number" });
  }

  const data: Prisma.ContractUpdateInput = {};
  if (typeof service === "string" && service.trim()) data.service = service.trim();
  if (value !== undefined) data.value = value;
  if (status !== undefined) data.status = status as ContractStatus;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;

  try {
    const contract = await prisma.contract.update({
      where: { id },
      data,
      include: { customer: { select: { id: true, name: true, company: true } } },
    });
    res.json({ contract });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Contract not found" });
    throw err;
  }
});

router.delete("/:id", requireRole(...FINANCE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.contract.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Contract not found" });
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ error: "Contract has related projects and cannot be deleted" });
    }
    throw err;
  }
});

export default router;
