import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { formatAssetNumber, formatContractNumber } from "../lib/maintenanceNumbers";
import { OPS_MANAGE_ROLES, OPS_SUBMIT_ROLES } from "../lib/roles";

const router = Router();

const FREQUENCIES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"] as const;
type Frequency = (typeof FREQUENCIES)[number];

const STATUSES = ["ACTIVE", "EXPIRED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

const ASSET_SELECT = {
  id: true,
  sequenceNumber: true,
  name: true,
  customer: { select: { id: true, name: true, company: true } },
};

function withContractNumber<T extends { sequenceNumber: number; asset: { sequenceNumber: number } }>(contract: T) {
  return {
    ...contract,
    contractNumber: formatContractNumber(contract.sequenceNumber),
    asset: { ...contract.asset, assetNumber: formatAssetNumber(contract.asset.sequenceNumber) },
  };
}

router.use(requireAuth);
router.use(requireRole(...OPS_SUBMIT_ROLES));

router.get("/", async (req, res) => {
  const { assetId, status, expiringSoon } = req.query;

  const where: Prisma.MaintenanceContractWhereInput = {};
  if (typeof assetId === "string" && assetId) {
    where.assetId = assetId;
  }
  if (typeof status === "string" && STATUSES.includes(status as Status)) {
    where.status = status as Status;
  }
  if (expiringSoon === "true") {
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    where.expiryDate = { lte: in30Days };
    where.status = "ACTIVE";
  }

  const contracts = await prisma.maintenanceContract.findMany({
    where,
    include: { asset: { select: ASSET_SELECT } },
    orderBy: { expiryDate: "asc" },
  });
  res.json({ contracts: contracts.map(withContractNumber) });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const contract = await prisma.maintenanceContract.findUnique({
    where: { id },
    include: {
      asset: { select: ASSET_SELECT },
      schedules: { orderBy: { scheduledDate: "desc" }, include: { report: true } },
    },
  });
  if (!contract) return res.status(404).json({ error: "Maintenance contract not found" });
  res.json({ contract: withContractNumber(contract) });
});

router.post("/", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const { assetId, frequency, startDate, expiryDate, notes } = req.body ?? {};

  if (typeof assetId !== "string" || !assetId) {
    return res.status(400).json({ error: "assetId is required" });
  }
  if (!FREQUENCIES.includes(frequency)) {
    return res.status(400).json({ error: "Invalid frequency" });
  }
  if (!startDate || Number.isNaN(new Date(startDate).getTime())) {
    return res.status(400).json({ error: "A valid start date is required" });
  }
  if (!expiryDate || Number.isNaN(new Date(expiryDate).getTime())) {
    return res.status(400).json({ error: "A valid expiry date is required" });
  }

  try {
    const contract = await prisma.maintenanceContract.create({
      data: {
        assetId,
        frequency: frequency as Frequency,
        startDate: new Date(startDate),
        expiryDate: new Date(expiryDate),
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
        createdById: req.user!.sub,
      },
      include: { asset: { select: ASSET_SELECT } },
    });
    res.status(201).json({ contract: withContractNumber(contract) });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Asset not found" });
    throw err;
  }
});

router.patch("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { frequency, startDate, expiryDate, status, notes } = req.body ?? {};

  if (frequency !== undefined && !FREQUENCIES.includes(frequency)) {
    return res.status(400).json({ error: "Invalid frequency" });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const data: Prisma.MaintenanceContractUpdateInput = {};
  if (frequency !== undefined) data.frequency = frequency as Frequency;
  if (startDate !== undefined) data.startDate = new Date(startDate);
  if (expiryDate !== undefined) data.expiryDate = new Date(expiryDate);
  if (status !== undefined) data.status = status as Status;
  if (notes !== undefined) data.notes = notes || null;

  try {
    const contract = await prisma.maintenanceContract.update({
      where: { id },
      data,
      include: { asset: { select: ASSET_SELECT } },
    });
    res.json({ contract: withContractNumber(contract) });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Maintenance contract not found" });
    throw err;
  }
});

router.delete("/:id", requireRole(...OPS_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.maintenanceContract.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Maintenance contract not found" });
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ error: "Contract has linked requests or schedules and cannot be deleted" });
    }
    throw err;
  }
});

export default router;
