import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";

const router = Router();

const STATUSES = ["SUBMITTED", "APPROVED", "REJECTED", "CONVERTED"] as const;
type Status = (typeof STATUSES)[number];

interface RequisitionItemInput {
  description: string;
  quantity: number;
  inventoryItemId?: string;
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { search, status, projectId } = req.query;

  const where: Prisma.PurchaseRequisitionWhereInput = {};
  if (typeof search === "string" && search.trim()) {
    where.requisitionNumber = { contains: search, mode: "insensitive" };
  }
  if (typeof status === "string" && STATUSES.includes(status as Status)) {
    where.status = status as Status;
  }
  if (typeof projectId === "string" && projectId) {
    where.projectId = projectId;
  }

  const requisitions = await prisma.purchaseRequisition.findMany({
    where,
    include: {
      project: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ requisitions });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const requisition = await prisma.purchaseRequisition.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      items: { include: { inventoryItem: { select: { id: true, sku: true, name: true } } } },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: { select: { id: true, name: true, email: true } } },
      },
      purchaseOrders: { select: { id: true, poNumber: true, status: true } },
    },
  });

  if (!requisition) {
    return res.status(404).json({ error: "Requisition not found" });
  }

  res.json({ requisition });
});

router.post("/", async (req, res) => {
  const { requisitionNumber, projectId, neededByDate, notes, items } = req.body ?? {};

  if (typeof requisitionNumber !== "string" || !requisitionNumber.trim()) {
    return res.status(400).json({ error: "Requisition number is required" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "At least one line item is required" });
  }
  for (const item of items as RequisitionItemInput[]) {
    if (typeof item.description !== "string" || !item.description.trim()) {
      return res.status(400).json({ error: "Every line item needs a description" });
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return res.status(400).json({ error: "Every line item needs a positive quantity" });
    }
  }

  try {
    const requisition = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseRequisition.create({
        data: {
          requisitionNumber: requisitionNumber.trim(),
          projectId: typeof projectId === "string" && projectId ? projectId : null,
          requestedById: req.user!.sub,
          neededByDate: neededByDate ? new Date(neededByDate) : null,
          notes: typeof notes === "string" && notes ? notes : null,
          items: {
            create: (items as RequisitionItemInput[]).map((item) => ({
              description: item.description.trim(),
              quantity: Math.trunc(item.quantity),
              inventoryItemId: item.inventoryItemId || null,
            })),
          },
        },
        include: { items: true },
      });
      await tx.requisitionStatusHistory.create({
        data: {
          requisitionId: created.id,
          fromStatus: null,
          toStatus: "SUBMITTED",
          changedById: req.user!.sub,
        },
      });
      return created;
    });
    res.status(201).json({ requisition });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "A requisition with that number already exists" });
    }
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Project or inventory item not found" });
    throw err;
  }
});

async function transitionStatus(
  id: string,
  toStatus: Status,
  allowedFrom: Status[],
  changedById: string,
  note: string | null,
) {
  const requisition = await prisma.purchaseRequisition.findUnique({ where: { id } });
  if (!requisition) return { error: "not_found" as const };

  const fromStatus = requisition.status as Status;
  if (!allowedFrom.includes(fromStatus)) {
    return { error: "invalid_transition" as const, fromStatus };
  }

  const [, updated] = await prisma.$transaction([
    prisma.requisitionStatusHistory.create({
      data: { requisitionId: id, fromStatus, toStatus, changedById, note },
    }),
    prisma.purchaseRequisition.update({ where: { id }, data: { status: toStatus } }),
  ]);

  return { requisition: updated };
}

router.post("/:id/approve", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};

  const result = await transitionStatus(id, "APPROVED", ["SUBMITTED"], req.user!.sub, typeof note === "string" && note ? note : null);
  if (result.error === "not_found") return res.status(404).json({ error: "Requisition not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot approve a requisition in ${result.fromStatus} status` });
  }
  res.json({ requisition: result.requisition });
});

router.post("/:id/reject", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};

  if (typeof note !== "string" || !note.trim()) {
    return res.status(400).json({ error: "A reason is required to reject a requisition" });
  }

  const result = await transitionStatus(id, "REJECTED", ["SUBMITTED"], req.user!.sub, note.trim());
  if (result.error === "not_found") return res.status(404).json({ error: "Requisition not found" });
  if (result.error === "invalid_transition") {
    return res.status(400).json({ error: `Cannot reject a requisition in ${result.fromStatus} status` });
  }
  res.json({ requisition: result.requisition });
});

router.post("/:id/convert", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
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

  const requisition = await prisma.purchaseRequisition.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!requisition) return res.status(404).json({ error: "Requisition not found" });
  if (requisition.status !== "APPROVED") {
    return res.status(400).json({ error: "Only an approved requisition can be converted to a purchase order" });
  }

  const itemsByReqItemId = new Map<string, number>(
    (items as { requisitionItemId: string; unitCost: number }[]).map((i) => [i.requisitionItemId, i.unitCost]),
  );

  for (const reqItem of requisition.items) {
    const unitCost = itemsByReqItemId.get(reqItem.id);
    if (!Number.isFinite(unitCost) || (unitCost as number) <= 0) {
      return res.status(400).json({ error: `Missing or invalid unit cost for "${reqItem.description}"` });
    }
  }

  const totalAmount = requisition.items.reduce(
    (sum, reqItem) => sum + reqItem.quantity * (itemsByReqItemId.get(reqItem.id) as number),
    0,
  );

  try {
    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber: poNumber.trim(),
          supplierId,
          requisitionId: id,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          totalAmount,
          items: {
            create: requisition.items.map((reqItem) => ({
              description: reqItem.description,
              quantity: reqItem.quantity,
              inventoryItemId: reqItem.inventoryItemId,
              unitCost: itemsByReqItemId.get(reqItem.id) as number,
            })),
          },
        },
        include: { items: true, supplier: true },
      });
      await tx.requisitionStatusHistory.create({
        data: {
          requisitionId: id,
          fromStatus: "APPROVED",
          toStatus: "CONVERTED",
          changedById: req.user!.sub,
          note: `Converted to PO ${po.poNumber}`,
        },
      });
      await tx.purchaseRequisition.update({ where: { id }, data: { status: "CONVERTED" } });
      return po;
    });
    res.status(201).json({ purchaseOrder });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "A purchase order with that number already exists" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Supplier not found" });
    throw err;
  }
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.purchaseRequisition.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Requisition not found" });
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ error: "Requisition has a linked purchase order and cannot be deleted" });
    }
    throw err;
  }
});

export default router;
