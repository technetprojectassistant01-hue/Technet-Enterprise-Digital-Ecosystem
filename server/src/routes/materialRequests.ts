import { Router, type Request, type Response } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { TOOL_MANAGE_ROLES, type Role } from "../lib/roles";
import { notifyEmployee, notifyRoles } from "../lib/notifications";
import { describeMaterialLines, formatMaterialRequestNumber, parseMaterialRequest } from "../lib/materialRequests";
import { formatMaterialNumber, parseIssueLines } from "../lib/materials";

/**
 * Material requests (2026-10-08, management): consumables such as glue, tape or screws, asked for
 * line by line (description, reference, quantity). Same shape as tool requests: anyone with a
 * linked employee record asks, the store (TOOL_MANAGE_ROLES - Admin, Storekeeper) issues or
 * rejects the whole request. The requester can edit it while pending and delete it unless issued.
 * Materials aren't tracked individually and don't come back, so there is no checkout/return.
 */
const router = Router();

const requestInclude = {
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
  items: { orderBy: { position: "asc" }, include: { material: { select: { id: true, sequenceNumber: true, name: true, unit: true } } } },
} satisfies Prisma.MaterialRequestInclude;

type RequestWithRelations = Prisma.MaterialRequestGetPayload<{ include: typeof requestInclude }>;

function serializeRequest(request: RequestWithRelations) {
  return {
    ...request,
    requestNumber: formatMaterialRequestNumber(request.sequenceNumber),
    items: request.items.map((i) => ({
      ...i,
      quantity: Number(i.quantity),
      issuedQuantity: i.issuedQuantity === null ? null : Number(i.issuedQuantity),
      material: i.material ? { ...i.material, materialNumber: formatMaterialNumber(i.material.sequenceNumber) } : null,
    })),
  };
}

function isManager(req: Request): boolean {
  return (TOOL_MANAGE_ROLES as readonly Role[]).includes(req.user!.role);
}

async function linkedEmployee(req: Request, res: Response) {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub } });
  if (!employee) {
    res.status(403).json({ error: "No employee record is linked to your account" });
    return null;
  }
  return employee;
}

const STATUSES = ["PENDING", "ISSUED", "REJECTED"] as const;

router.use(requireAuth);

/** The store sees every request; everyone else only their own. */
router.get("/", async (req, res) => {
  const { status, employeeId } = req.query;
  const where: Prisma.MaterialRequestWhereInput = {};
  if (isManager(req)) {
    if (typeof employeeId === "string" && employeeId) where.employeeId = employeeId;
  } else {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub }, select: { id: true } });
    if (!employee) return res.json({ requests: [] });
    where.employeeId = employee.id;
  }
  if (typeof status === "string" && (STATUSES as readonly string[]).includes(status)) {
    where.status = status as (typeof STATUSES)[number];
  }
  const requests = await prisma.materialRequest.findMany({ where, include: requestInclude, orderBy: { createdAt: "desc" } });
  res.json({ requests: requests.map(serializeRequest) });
});

router.post("/", async (req, res) => {
  const employee = await linkedEmployee(req, res);
  if (!employee) return;
  const parsed = parseMaterialRequest(req.body ?? {});
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  const { items, ...fields } = parsed.data;
  const request = await prisma.materialRequest.create({
    data: { ...fields, employeeId: employee.id, items: { create: items.map((l, i) => ({ ...l, position: i + 1 })) } },
    include: requestInclude,
  });
  await notifyRoles(
    TOOL_MANAGE_ROLES,
    "MATERIAL_REQUEST_SUBMITTED",
    `${employee.firstName} ${employee.lastName} requested materials (${formatMaterialRequestNumber(request.sequenceNumber)})`,
    { message: describeMaterialLines(request.items), link: "/dashboard/store/materials" },
  );
  res.status(201).json({ request: serializeRequest(request) });
});

/** The requester edits their own request - only while it's still pending. Lines are replaced. */
router.put("/:id", async (req, res) => {
  const employee = await linkedEmployee(req, res);
  if (!employee) return;
  const id = req.params.id as string;
  const existing = await prisma.materialRequest.findUnique({ where: { id } });
  if (!existing || existing.employeeId !== employee.id) return res.status(404).json({ error: "Material request not found" });

  const parsed = parseMaterialRequest(req.body ?? {});
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const { items, ...fields } = parsed.data;

  // Conditional inside the transaction, so an edit can't land after the store has just acted.
  const ok = await prisma.$transaction(async (tx) => {
    const updated = await tx.materialRequest.updateMany({ where: { id, employeeId: employee.id, status: "PENDING" }, data: fields });
    if (updated.count === 0) return false;
    await tx.materialRequestItem.deleteMany({ where: { requestId: id } });
    await tx.materialRequestItem.createMany({ data: items.map((l, i) => ({ ...l, position: i + 1, requestId: id })) });
    return true;
  });
  if (!ok) {
    const current = await prisma.materialRequest.findUnique({ where: { id }, select: { status: true } });
    return res.status(409).json({ error: `Request is already ${(current?.status ?? existing.status).toLowerCase()} and can no longer be edited` });
  }

  const request = await prisma.materialRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
  await notifyRoles(
    TOOL_MANAGE_ROLES,
    "MATERIAL_REQUEST_SUBMITTED",
    `${employee.firstName} ${employee.lastName} updated their material request ${formatMaterialRequestNumber(request.sequenceNumber)}`,
    { message: describeMaterialLines(request.items), link: "/dashboard/store/materials" },
  );
  res.json({ request: serializeRequest(request) });
});

/** The requester deletes their own request, unless it was issued - that stays as the record. */
router.delete("/:id", async (req, res) => {
  const employee = await linkedEmployee(req, res);
  if (!employee) return;
  const id = req.params.id as string;
  const existing = await prisma.materialRequest.findUnique({ where: { id } });
  if (!existing || existing.employeeId !== employee.id) return res.status(404).json({ error: "Material request not found" });

  const deleted = await prisma.materialRequest.deleteMany({ where: { id, employeeId: employee.id, status: { not: "ISSUED" } } });
  if (deleted.count === 0) {
    return res.status(409).json({ error: "This request has been issued, so it is kept as a record and can't be deleted" });
  }
  res.status(204).end();
});

/** The store turns a pending request down, with an optional reason the requester sees. */
async function reject(req: Request, res: Response) {
  const id = req.params.id as string;
  const { note } = req.body ?? {};
  const reviewNote = typeof note === "string" && note.trim() ? note.trim() : null;
  const existing = await prisma.materialRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Material request not found" });

  // Conditional, so two storekeepers acting at once can't both decide the same request.
  const updated = await prisma.materialRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED", reviewedById: req.user!.sub, reviewedAt: new Date(), reviewNote },
  });
  if (updated.count === 0) return res.status(409).json({ error: `Request is already ${existing.status.toLowerCase()}` });

  const request = await prisma.materialRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
  await notifyEmployee(request.employeeId, "MATERIAL_REQUEST_REJECTED", `Your material request ${formatMaterialRequestNumber(request.sequenceNumber)} was not approved`, {
    message: reviewNote ?? undefined,
    link: "/dashboard/store/materials",
  });
  res.json({ request: serializeRequest(request) });
}

/** Thrown inside the issue transaction to roll it back with a specific response. */
class IssueError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Issues the request (2026-10-09): each line may be matched to a material in the store's register
 * and its stock is reduced by the quantity handed over - refused, with nothing changed, if any
 * material hasn't got enough. A line with no match is issued without touching stock. Body:
 * { note?, lines: [{ itemId, materialId?, quantity? }] } - lines left out are issued as asked.
 */
router.post("/:id/issue", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { note, lines: rawLines } = req.body ?? {};
  const reviewNote = typeof note === "string" && note.trim() ? note.trim() : null;
  const existing = await prisma.materialRequest.findUnique({ where: { id }, include: { items: true } });
  if (!existing) return res.status(404).json({ error: "Material request not found" });

  const parsed = parseIssueLines(rawLines, new Map(existing.items.map((i) => [i.id, Number(i.quantity)])));
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.materialRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "ISSUED", reviewedById: req.user!.sub, reviewedAt: new Date(), reviewNote },
      });
      if (claimed.count === 0) throw new IssueError(409, `Request is already ${existing.status.toLowerCase()}`);

      for (const line of parsed.lines) {
        if (line.materialId) {
          // Conditional decrement, so two issues at once can't take stock below zero.
          const taken = await tx.material.updateMany({
            where: { id: line.materialId, quantity: { gte: line.quantity } },
            data: { quantity: { decrement: line.quantity } },
          });
          if (taken.count === 0) {
            const m = await tx.material.findUnique({ where: { id: line.materialId }, select: { name: true, quantity: true, unit: true } });
            if (!m) throw new IssueError(400, "A chosen material no longer exists - refresh and try again");
            throw new IssueError(409, `Not enough ${m.name} in stock: ${Number(m.quantity)} ${m.unit} left, ${line.quantity} needed`);
          }
          const after = await tx.material.findUniqueOrThrow({ where: { id: line.materialId }, select: { quantity: true } });
          await tx.materialMovement.create({
            data: {
              materialId: line.materialId,
              type: "OUT",
              quantity: line.quantity,
              balanceAfter: after.quantity,
              reason: `Issued for ${formatMaterialRequestNumber(existing.sequenceNumber)}`,
              requestItemId: line.itemId,
              createdById: req.user!.sub,
            },
          });
        }
        await tx.materialRequestItem.update({ where: { id: line.itemId }, data: { materialId: line.materialId, issuedQuantity: line.quantity } });
      }
    });
  } catch (err) {
    if (err instanceof IssueError) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const request = await prisma.materialRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
  await notifyEmployee(request.employeeId, "MATERIAL_REQUEST_ISSUED", `Your material request ${formatMaterialRequestNumber(request.sequenceNumber)} is ready to collect`, {
    message: reviewNote ?? describeMaterialLines(request.items.map((i) => ({ ...i, quantity: i.issuedQuantity ?? i.quantity }))),
    link: "/dashboard/store/materials",
  });
  res.json({ request: serializeRequest(request) });
});
router.post("/:id/reject", requireRole(...TOOL_MANAGE_ROLES), reject);

export default router;
