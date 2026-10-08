import { Router, type Request, type Response } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { TOOL_MANAGE_ROLES, type Role } from "../lib/roles";
import { notifyEmployee, notifyRoles } from "../lib/notifications";
import { describeMaterialLines, formatMaterialRequestNumber, parseMaterialRequest } from "../lib/materialRequests";

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
  items: { orderBy: { position: "asc" } },
} satisfies Prisma.MaterialRequestInclude;

type RequestWithRelations = Prisma.MaterialRequestGetPayload<{ include: typeof requestInclude }>;

function serializeRequest(request: RequestWithRelations) {
  return {
    ...request,
    requestNumber: formatMaterialRequestNumber(request.sequenceNumber),
    items: request.items.map((i) => ({ ...i, quantity: Number(i.quantity) })),
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

async function decide(req: Request, res: Response, status: "ISSUED" | "REJECTED") {
  const id = req.params.id as string;
  const { note } = req.body ?? {};
  const reviewNote = typeof note === "string" && note.trim() ? note.trim() : null;
  const existing = await prisma.materialRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Material request not found" });

  // Conditional, so two storekeepers acting at once can't both decide the same request.
  const updated = await prisma.materialRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status, reviewedById: req.user!.sub, reviewedAt: new Date(), reviewNote },
  });
  if (updated.count === 0) return res.status(409).json({ error: `Request is already ${existing.status.toLowerCase()}` });

  const request = await prisma.materialRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
  const number = formatMaterialRequestNumber(request.sequenceNumber);
  await notifyEmployee(
    request.employeeId,
    status === "ISSUED" ? "MATERIAL_REQUEST_ISSUED" : "MATERIAL_REQUEST_REJECTED",
    status === "ISSUED" ? `Your material request ${number} is ready to collect` : `Your material request ${number} was not approved`,
    { message: reviewNote ?? (status === "ISSUED" ? describeMaterialLines(request.items) : undefined), link: "/dashboard/store/materials" },
  );
  res.json({ request: serializeRequest(request) });
}

router.post("/:id/issue", requireRole(...TOOL_MANAGE_ROLES), (req, res) => decide(req, res, "ISSUED"));
router.post("/:id/reject", requireRole(...TOOL_MANAGE_ROLES), (req, res) => decide(req, res, "REJECTED"));

export default router;
