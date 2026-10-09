import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { TOOL_MANAGE_ROLES } from "../lib/roles";
import { formatMaterialNumber, isLowStock, parseMaterialFields, parseStockChange } from "../lib/materials";
import { formatMaterialRequestNumber } from "../lib/materialRequests";

/**
 * The Technet Store materials register (2026-10-09, user request): consumables such as glue or
 * screws, kept by quantity - a separate list from ERP Inventory (the user's choice). Everyone signed
 * in can see it and their own "Materials I Have"; the store (TOOL_MANAGE_ROLES) adds and edits
 * materials and changes stock. Stock only moves through Add stock, Correct count, or issuing a
 * material request (routes/materialRequests.ts), and every change is a MaterialMovement.
 */
const router = Router();
router.use(requireAuth);

type MaterialRow = Prisma.MaterialGetPayload<object>;

function serialize(m: MaterialRow) {
  const quantity = Number(m.quantity);
  const minStock = Number(m.minStock);
  return { ...m, materialNumber: formatMaterialNumber(m.sequenceNumber), quantity, minStock, lowStock: isLowStock(quantity, minStock) };
}

router.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const where: Prisma.MaterialWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { reference: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};
  const materials = await prisma.material.findMany({ where, orderBy: { name: "asc" } });
  let rows = materials.map(serialize);
  if (req.query.lowStock === "true") rows = rows.filter((m) => m.lowStock);
  res.json({ materials: rows });
});

/** "Materials I Have": every request line issued to the signed-in employee, newest first. */
router.get("/mine", async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub }, select: { id: true } });
  if (!employee) return res.json({ items: [] });
  const items = await prisma.materialRequestItem.findMany({
    where: { request: { employeeId: employee.id, status: "ISSUED" } },
    include: {
      request: { select: { id: true, sequenceNumber: true, reviewedAt: true, purpose: true } },
      material: { select: { id: true, sequenceNumber: true, name: true, unit: true } },
    },
    orderBy: [{ request: { reviewedAt: "desc" } }, { position: "asc" }],
  });
  res.json({
    items: items.map((i) => ({
      id: i.id,
      description: i.description,
      reference: i.reference,
      quantity: Number(i.issuedQuantity ?? i.quantity),
      issuedAt: i.request.reviewedAt,
      purpose: i.request.purpose,
      requestNumber: formatMaterialRequestNumber(i.request.sequenceNumber),
      material: i.material ? { ...i.material, materialNumber: formatMaterialNumber(i.material.sequenceNumber) } : null,
    })),
  });
});

router.post("/", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const parsed = parseMaterialFields(req.body ?? {}, { withQuantity: true });
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const { quantity = 0, ...fields } = parsed.data;
  const material = await prisma.$transaction(async (tx) => {
    const created = await tx.material.create({ data: { ...fields, quantity } });
    if (quantity > 0) {
      await tx.materialMovement.create({
        data: { materialId: created.id, type: "IN", quantity, balanceAfter: quantity, reason: "Opening stock", createdById: req.user!.sub },
      });
    }
    return created;
  });
  res.status(201).json({ material: serialize(material) });
});

/** Details only - stock never changes here, so every stock change stays on the history. */
router.patch("/:id", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const parsed = parseMaterialFields(req.body ?? {});
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const existing = await prisma.material.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Material not found" });
  const material = await prisma.material.update({ where: { id }, data: parsed.data });
  res.json({ material: serialize(material) });
});

/** Add stock (a delivery) or correct the count after a stock-take. */
router.post("/:id/stock", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const parsed = parseStockChange(req.body ?? {});
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const change = parsed.data;

  const material = await prisma.$transaction(async (tx) => {
    const current = await tx.material.findUnique({ where: { id } });
    if (!current) return null;
    const before = Number(current.quantity);
    const after = change.type === "IN" ? before + change.quantity : change.count;
    const updated = await tx.material.update({ where: { id }, data: { quantity: after } });
    await tx.materialMovement.create({
      data: {
        materialId: id,
        type: change.type,
        quantity: change.type === "IN" ? change.quantity : Math.round((after - before) * 100) / 100,
        balanceAfter: after,
        reason: change.reason,
        createdById: req.user!.sub,
      },
    });
    return updated;
  });
  if (!material) return res.status(404).json({ error: "Material not found" });
  res.json({ material: serialize(material) });
});

router.get("/:id/movements", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const movements = await prisma.materialMovement.findMany({
    where: { materialId: id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  // Name the request each OUT movement came from.
  const itemIds = movements.map((m) => m.requestItemId).filter((x): x is string => !!x);
  const items = itemIds.length
    ? await prisma.materialRequestItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, request: { select: { sequenceNumber: true, employee: { select: { firstName: true, lastName: true } } } } },
      })
    : [];
  const byItem = new Map(items.map((i) => [i.id, i]));
  res.json({
    movements: movements.map((m) => {
      const item = m.requestItemId ? byItem.get(m.requestItemId) : undefined;
      return {
        ...m,
        quantity: Number(m.quantity),
        balanceAfter: Number(m.balanceAfter),
        request: item
          ? { requestNumber: formatMaterialRequestNumber(item.request.sequenceNumber), employee: `${item.request.employee.firstName} ${item.request.employee.lastName}` }
          : null,
      };
    }),
  });
});

/** Only a material that was never issued; one with history stays as the record. */
router.delete("/:id", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const existing = await prisma.material.findUnique({ where: { id }, include: { _count: { select: { requestItems: true } } } });
  if (!existing) return res.status(404).json({ error: "Material not found" });
  if (existing._count.requestItems > 0) {
    return res.status(409).json({ error: "This material has been issued against requests, so it is kept as a record and can't be deleted" });
  }
  await prisma.material.delete({ where: { id } });
  res.status(204).end();
});

export default router;
