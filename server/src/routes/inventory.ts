import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isUniqueConstraintError, isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { PROCUREMENT_ROLES, NON_FIELD_ROLES } from "../lib/roles";

const router = Router();
const MOVEMENT_TYPES = ["IN", "OUT", "ADJUSTMENT"] as const;
type MovementType = (typeof MOVEMENT_TYPES)[number];

router.use(requireAuth, requireRole(...NON_FIELD_ROLES));

router.get("/", async (req, res) => {
  const { search, lowStock } = req.query;

  const where: Prisma.InventoryItemWhereInput = {};
  if (typeof search === "string" && search.trim()) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }

  let items = await prisma.inventoryItem.findMany({
    where,
    orderBy: { name: "asc" },
  });

  if (lowStock === "true") {
    items = items.filter((item) => item.quantity <= item.minStockLevel);
  }

  res.json({ items });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { movements: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  if (!item) {
    return res.status(404).json({ error: "Inventory item not found" });
  }

  res.json({ item });
});

router.post("/", requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const { sku, name, category, unitOfMeasure, quantity, minStockLevel, unitCost, location } =
    req.body ?? {};

  if (typeof sku !== "string" || !sku.trim() || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "SKU and name are required" });
  }

  try {
    const item = await prisma.inventoryItem.create({
      data: {
        sku: sku.trim(),
        name: name.trim(),
        category: typeof category === "string" ? category : null,
        unitOfMeasure: typeof unitOfMeasure === "string" && unitOfMeasure ? unitOfMeasure : "unit",
        quantity: Number.isFinite(quantity) ? Math.max(0, Math.trunc(quantity)) : 0,
        minStockLevel: Number.isFinite(minStockLevel) ? Math.max(0, Math.trunc(minStockLevel)) : 0,
        unitCost: unitCost === undefined || unitCost === null || unitCost === "" ? null : unitCost,
        location: typeof location === "string" ? location : null,
      },
    });
    res.status(201).json({ item });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "An item with that SKU already exists" });
    throw err;
  }
});

router.patch("/:id", requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { sku, name, category, unitOfMeasure, minStockLevel, unitCost, location } = req.body ?? {};

  const data: Prisma.InventoryItemUpdateInput = {};
  if (typeof sku === "string" && sku.trim()) data.sku = sku.trim();
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (category !== undefined) data.category = typeof category === "string" ? category : null;
  if (typeof unitOfMeasure === "string" && unitOfMeasure) data.unitOfMeasure = unitOfMeasure;
  if (Number.isFinite(minStockLevel)) data.minStockLevel = Math.max(0, Math.trunc(minStockLevel));
  if (unitCost !== undefined) data.unitCost = unitCost === null || unitCost === "" ? null : unitCost;
  if (location !== undefined) data.location = typeof location === "string" ? location : null;

  try {
    const item = await prisma.inventoryItem.update({
      where: { id },
      data,
    });
    res.json({ item });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Inventory item not found" });
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "An item with that SKU already exists" });
    throw err;
  }
});

router.delete("/:id", requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.inventoryItem.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Inventory item not found" });
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ error: "Item is referenced by a purchase order and cannot be deleted" });
    }
    throw err;
  }
});

router.post("/:id/adjust", requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { type, quantity, reason } = req.body ?? {};

  if (!MOVEMENT_TYPES.includes(type)) {
    return res.status(400).json({ error: "Type must be one of IN, OUT, ADJUSTMENT" });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ error: "Quantity must be a positive number" });
  }

  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) {
    return res.status(404).json({ error: "Inventory item not found" });
  }

  const delta = type === "OUT" ? -quantity : quantity;
  const newQuantity = item.quantity + delta;

  if (newQuantity < 0) {
    return res.status(400).json({ error: "Adjustment would drop stock below zero" });
  }

  const [, updated] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        inventoryItemId: item.id,
        type: type as MovementType,
        quantity: Math.trunc(quantity),
        reason: typeof reason === "string" ? reason : null,
        createdById: req.user!.sub,
      },
    }),
    prisma.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: newQuantity },
    }),
  ]);

  res.json({ item: updated });
});

export default router;
