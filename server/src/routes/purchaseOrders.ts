import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { PROCUREMENT_ROLES } from "../lib/roles";

const router = Router();

const STATUSES = ["DRAFT", "SENT", "PARTIALLY_RECEIVED", "FULLY_RECEIVED", "CLOSED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

interface POItemInput {
  description: string;
  quantity: number;
  unitCost: number;
  inventoryItemId?: string;
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { search, status, supplierId } = req.query;

  const where: Prisma.PurchaseOrderWhereInput = {};
  if (typeof search === "string" && search.trim()) {
    where.poNumber = { contains: search, mode: "insensitive" };
  }
  if (typeof status === "string" && STATUSES.includes(status as Status)) {
    where.status = status as Status;
  }
  if (typeof supplierId === "string" && supplierId) {
    where.supplierId = supplierId;
  }

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ purchaseOrders });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      requisition: { select: { id: true, requisitionNumber: true } },
      items: {
        include: {
          inventoryItem: { select: { id: true, sku: true, name: true } },
          goodsReceiptItems: true,
        },
      },
      goodsReceipts: {
        orderBy: { createdAt: "desc" },
        include: {
          receivedBy: { select: { id: true, name: true, email: true } },
          items: true,
        },
      },
    },
  });

  if (!purchaseOrder) {
    return res.status(404).json({ error: "Purchase order not found" });
  }

  res.json({ purchaseOrder });
});

router.post("/", requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const { supplierId, poNumber, expectedDate, items } = req.body ?? {};

  if (typeof supplierId !== "string" || !supplierId) {
    return res.status(400).json({ error: "supplierId is required" });
  }
  if (typeof poNumber !== "string" || !poNumber.trim()) {
    return res.status(400).json({ error: "PO number is required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "At least one line item is required" });
  }
  for (const item of items as POItemInput[]) {
    if (typeof item.description !== "string" || !item.description.trim()) {
      return res.status(400).json({ error: "Every line item needs a description" });
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return res.status(400).json({ error: "Every line item needs a positive quantity" });
    }
    if (!Number.isFinite(item.unitCost) || item.unitCost <= 0) {
      return res.status(400).json({ error: "Every line item needs a positive unit cost" });
    }
  }

  const totalAmount = (items as POItemInput[]).reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  try {
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber: poNumber.trim(),
        supplierId,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        totalAmount,
        items: {
          create: (items as POItemInput[]).map((item) => ({
            description: item.description.trim(),
            quantity: Math.trunc(item.quantity),
            unitCost: item.unitCost,
            inventoryItemId: item.inventoryItemId || null,
          })),
        },
      },
      include: { items: true, supplier: true },
    });
    res.status(201).json({ purchaseOrder });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "A purchase order with that number already exists" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Supplier or inventory item not found" });
    throw err;
  }
});

router.patch("/:id", requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { expectedDate } = req.body ?? {};

  const data: Prisma.PurchaseOrderUpdateInput = {};
  if (expectedDate !== undefined) data.expectedDate = expectedDate ? new Date(expectedDate) : null;

  try {
    const purchaseOrder = await prisma.purchaseOrder.update({ where: { id }, data });
    res.json({ purchaseOrder });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Purchase order not found" });
    throw err;
  }
});

async function transitionStatus(id: string, toStatus: Status, allowedFrom: Status[]) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) return { error: "not_found" as const };

  const fromStatus = po.status as Status;
  if (!allowedFrom.includes(fromStatus)) {
    return { error: "invalid_transition" as const, fromStatus };
  }

  const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: toStatus } });
  return { purchaseOrder: updated };
}

router.post("/:id/send", requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const result = await transitionStatus(id, "SENT", ["DRAFT"]);
  if (result.error === "not_found") return res.status(404).json({ error: "Purchase order not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot send a purchase order in ${result.fromStatus} status` });
  }
  res.json({ purchaseOrder: result.purchaseOrder });
});

router.post("/:id/cancel", requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const result = await transitionStatus(id, "CANCELLED", ["DRAFT", "SENT"]);
  if (result.error === "not_found") return res.status(404).json({ error: "Purchase order not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot cancel a purchase order in ${result.fromStatus} status` });
  }
  res.json({ purchaseOrder: result.purchaseOrder });
});

router.post("/:id/close", requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const result = await transitionStatus(id, "CLOSED", ["FULLY_RECEIVED"]);
  if (result.error === "not_found") return res.status(404).json({ error: "Purchase order not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot close a purchase order in ${result.fromStatus} status` });
  }
  res.json({ purchaseOrder: result.purchaseOrder });
});

router.post("/:id/receive", requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { items, notes } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "At least one received line item is required" });
  }

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: { include: { goodsReceiptItems: true } } },
  });
  if (!po) return res.status(404).json({ error: "Purchase order not found" });
  if (po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
    return res.status(400).json({ error: `Cannot record a receipt against a purchase order in ${po.status} status` });
  }

  const receivedByPoItemId = new Map<string, number>(
    (items as { purchaseOrderItemId: string; quantityReceived: number }[]).map((i) => [i.purchaseOrderItemId, i.quantityReceived]),
  );

  const poItemById = new Map(po.items.map((i) => [i.id, i]));

  for (const [poItemId, qty] of receivedByPoItemId) {
    const poItem = poItemById.get(poItemId);
    if (!poItem) return res.status(400).json({ error: "Line item does not belong to this purchase order" });
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: `Quantity received for "${poItem.description}" must be positive` });
    }
    const alreadyReceived = poItem.goodsReceiptItems.reduce((sum, gri) => sum + gri.quantityReceived, 0);
    const remaining = poItem.quantity - alreadyReceived;
    if (qty > remaining) {
      return res.status(400).json({ error: `Cannot receive ${qty} of "${poItem.description}" — only ${remaining} remaining` });
    }
  }

  const goodsReceipt = await prisma.$transaction(async (tx) => {
    const receipt = await tx.goodsReceipt.create({
      data: {
        purchaseOrderId: id,
        receivedById: req.user!.sub,
        notes: typeof notes === "string" && notes ? notes : null,
        items: {
          create: Array.from(receivedByPoItemId.entries()).map(([purchaseOrderItemId, quantityReceived]) => ({
            purchaseOrderItemId,
            quantityReceived: Math.trunc(quantityReceived),
          })),
        },
      },
      include: { items: true },
    });

    for (const [poItemId, qty] of receivedByPoItemId) {
      const poItem = poItemById.get(poItemId)!;
      if (poItem.inventoryItemId) {
        await tx.stockMovement.create({
          data: {
            inventoryItemId: poItem.inventoryItemId,
            type: "IN",
            quantity: Math.trunc(qty),
            reason: `Goods receipt for PO ${po.poNumber}`,
            createdById: req.user!.sub,
          },
        });
        await tx.inventoryItem.update({
          where: { id: poItem.inventoryItemId },
          data: { quantity: { increment: Math.trunc(qty) } },
        });
      }
    }

    const allFullyReceived = po.items.every((poItem) => {
      const alreadyReceived = poItem.goodsReceiptItems.reduce((sum, gri) => sum + gri.quantityReceived, 0);
      const justReceived = receivedByPoItemId.get(poItem.id) ?? 0;
      return alreadyReceived + justReceived >= poItem.quantity;
    });

    await tx.purchaseOrder.update({
      where: { id },
      data: { status: allFullyReceived ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED" },
    });

    return receipt;
  });

  res.status(201).json({ goodsReceipt });
});

router.delete("/:id", requireRole(...PROCUREMENT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.purchaseOrder.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Purchase order not found" });
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ error: "Purchase order has goods receipts and cannot be deleted" });
    }
    throw err;
  }
});

export default router;
