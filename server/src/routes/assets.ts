import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { formatAssetNumber, formatContractNumber, formatRequestNumber } from "../lib/maintenanceNumbers";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";

const router = Router();

const STATUSES = ["ACTIVE", "DECOMMISSIONED"] as const;
type Status = (typeof STATUSES)[number];

const CUSTOMER_SELECT = { id: true, name: true, company: true, address: true };
const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, position: true };

function withAssetNumber<T extends { sequenceNumber: number }>(asset: T) {
  return { ...asset, assetNumber: formatAssetNumber(asset.sequenceNumber) };
}

router.use(requireAuth);
router.use(requireRole(...OPS_SUBMIT_ROLES));

router.get("/", async (req, res) => {
  const { search, customerId, status, category } = req.query;

  const where: Prisma.AssetWhereInput = {};
  if (typeof search === "string" && search.trim()) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { serialNumber: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ];
  }
  if (typeof customerId === "string" && customerId) {
    where.customerId = customerId;
  }
  if (typeof status === "string" && STATUSES.includes(status as Status)) {
    where.status = status as Status;
  }
  if (typeof category === "string" && category) {
    where.category = { equals: category, mode: "insensitive" };
  }

  const assets = await prisma.asset.findMany({
    where,
    include: { customer: { select: CUSTOMER_SELECT } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ assets: assets.map(withAssetNumber) });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      customer: { select: CUSTOMER_SELECT },
      contracts: { orderBy: { startDate: "desc" } },
      requests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { OR: [{ contract: { assetId: id } }, { request: { assetId: id } }] },
    include: {
      technicians: { include: { employee: { select: EMPLOYEE_SELECT } } },
      report: true,
      contract: { select: { id: true, sequenceNumber: true } },
      request: { select: { id: true, sequenceNumber: true } },
    },
    orderBy: { scheduledDate: "desc" },
  });

  res.json({
    asset: {
      ...withAssetNumber(asset),
      contracts: asset.contracts.map((c) => ({ ...c, contractNumber: formatContractNumber(c.sequenceNumber) })),
      requests: asset.requests.map((r) => ({ ...r, requestNumber: formatRequestNumber(r.sequenceNumber) })),
      schedules: schedules.map((s) => ({
        ...s,
        contract: s.contract ? { ...s.contract, contractNumber: formatContractNumber(s.contract.sequenceNumber) } : null,
        request: s.request ? { ...s.request, requestNumber: formatRequestNumber(s.request.sequenceNumber) } : null,
      })),
    },
  });
});

router.post("/", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const { name, category, serialNumber, location, customerId, notes } = req.body ?? {};

  if (typeof customerId !== "string" || !customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  try {
    const asset = await prisma.asset.create({
      data: {
        name: name.trim(),
        category: typeof category === "string" && category.trim() ? category.trim() : null,
        serialNumber: typeof serialNumber === "string" && serialNumber.trim() ? serialNumber.trim() : null,
        location: typeof location === "string" && location.trim() ? location.trim() : null,
        customerId,
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      },
      include: { customer: { select: CUSTOMER_SELECT } },
    });
    res.status(201).json({ asset: withAssetNumber(asset) });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "An asset with that serial number already exists" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer not found" });
    throw err;
  }
});

router.patch("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { name, category, serialNumber, location, status, notes } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const data: Prisma.AssetUpdateInput = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (category !== undefined) data.category = category || null;
  if (serialNumber !== undefined) data.serialNumber = serialNumber || null;
  if (location !== undefined) data.location = location || null;
  if (status !== undefined) data.status = status as Status;
  if (notes !== undefined) data.notes = notes || null;

  try {
    const asset = await prisma.asset.update({
      where: { id },
      data,
      include: { customer: { select: CUSTOMER_SELECT } },
    });
    res.json({ asset: withAssetNumber(asset) });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Asset not found" });
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "An asset with that serial number already exists" });
    throw err;
  }
});

router.delete("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.asset.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Asset not found" });
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ error: "Asset has contracts or requests and cannot be deleted" });
    }
    throw err;
  }
});

export default router;
