import { Router, type Request, type Response } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { TOOL_MANAGE_ROLES, type Role } from "../lib/roles";
import { notifyEmployee, notifyRoles } from "../lib/notifications";
import { parseDateOnly } from "../lib/leaveRequests";
import { formatToolNumber, formatToolRequestNumber, parseToolIds } from "../lib/tools";

/**
 * Tool requests: a technician asks for tools in their own words, an Admin/Storekeeper issues
 * specific registered tools against it (or rejects it). The requester can edit their request while
 * it's pending and delete it as long as no tools were issued against it. Anyone with a linked
 * employee record can request - not tied to a role.
 */
const router = Router();

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, employeeCode: true };

const requestInclude = {
  employee: { select: EMPLOYEE_SELECT },
  reviewedBy: { select: { id: true, name: true, email: true } },
  checkouts: { include: { tool: true }, orderBy: { issuedAt: "asc" } },
} satisfies Prisma.ToolRequestInclude;

type RequestWithRelations = Prisma.ToolRequestGetPayload<{ include: typeof requestInclude }>;

function serializeRequest(request: RequestWithRelations) {
  return {
    ...request,
    requestNumber: formatToolRequestNumber(request.sequenceNumber),
    checkouts: request.checkouts.map((c) => ({
      ...c,
      tool: { ...c.tool, toolNumber: formatToolNumber(c.tool.sequenceNumber) },
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

/** Thrown inside the issue transaction to roll it back with a specific response. */
class IssueError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

router.use(requireAuth);

/** Managers see every request; everyone else sees only their own. */
router.get("/", async (req, res) => {
  const { status, employeeId } = req.query;
  const where: Prisma.ToolRequestWhereInput = {};

  if (isManager(req)) {
    if (typeof employeeId === "string" && employeeId) where.employeeId = employeeId;
  } else {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub }, select: { id: true } });
    if (!employee) return res.json({ requests: [] });
    where.employeeId = employee.id;
  }
  if (typeof status === "string" && ["PENDING", "ISSUED", "REJECTED", "CANCELLED"].includes(status)) {
    where.status = status as Prisma.EnumToolRequestStatusFilter["equals"];
  }

  const requests = await prisma.toolRequest.findMany({ where, include: requestInclude, orderBy: { createdAt: "desc" } });
  res.json({ requests: requests.map(serializeRequest) });
});

/** Validates the fields a requester fills in. Returns the data to save, or an error message. */
function parseRequestFields(body: Record<string, unknown>) {
  const { items, typeOrBrand, purpose, neededBy } = body;
  if (typeof items !== "string" || !items.trim()) {
    return { error: "Say which tools or equipment you need" } as const;
  }
  let neededByDate: Date | null = null;
  if (neededBy !== undefined && neededBy !== null && neededBy !== "") {
    neededByDate = parseDateOnly(neededBy);
    if (!neededByDate) return { error: "Invalid needed-by date" } as const;
  }
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  return {
    data: { items: items.trim(), typeOrBrand: text(typeOrBrand), purpose: text(purpose), neededBy: neededByDate },
  } as const;
}

router.post("/", async (req, res) => {
  const employee = await linkedEmployee(req, res);
  if (!employee) return;

  const parsed = parseRequestFields(req.body ?? {});
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  const request = await prisma.toolRequest.create({
    data: { ...parsed.data, employeeId: employee.id },
    include: requestInclude,
  });

  await notifyRoles(
    TOOL_MANAGE_ROLES,
    "TOOL_REQUEST_SUBMITTED",
    `${employee.firstName} ${employee.lastName} requested tools`,
    { message: request.items, link: "/dashboard/store/requests" },
  );
  res.status(201).json({ request: serializeRequest(request) });
});

/** The requester edits their own request - only while it's still pending, before the store acts on it. */
router.put("/:id", async (req, res) => {
  const employee = await linkedEmployee(req, res);
  if (!employee) return;

  const id = req.params.id as string;
  const existing = await prisma.toolRequest.findUnique({ where: { id } });
  if (!existing || existing.employeeId !== employee.id) {
    return res.status(404).json({ error: "Tool request not found" });
  }

  const parsed = parseRequestFields(req.body ?? {});
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });

  // Conditional, so an edit can't slip in after the store has just issued or rejected it.
  const updated = await prisma.toolRequest.updateMany({
    where: { id, employeeId: employee.id, status: "PENDING" },
    data: parsed.data,
  });
  if (updated.count === 0) {
    const current = await prisma.toolRequest.findUnique({ where: { id }, select: { status: true } });
    return res
      .status(409)
      .json({ error: `Request is already ${(current?.status ?? existing.status).toLowerCase()} and can no longer be edited` });
  }

  const request = await prisma.toolRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
  await notifyRoles(
    TOOL_MANAGE_ROLES,
    "TOOL_REQUEST_SUBMITTED",
    `${employee.firstName} ${employee.lastName} updated their tool request ${formatToolRequestNumber(request.sequenceNumber)}`,
    { message: request.items, link: "/dashboard/store/requests" },
  );
  res.json({ request: serializeRequest(request) });
});

/**
 * The requester deletes their own request. Allowed whenever no tools were issued against it
 * (pending, rejected or withdrawn); an issued request is the record of who took which tools, so it
 * stays.
 */
router.delete("/:id", async (req, res) => {
  const employee = await linkedEmployee(req, res);
  if (!employee) return;

  const id = req.params.id as string;
  const existing = await prisma.toolRequest.findUnique({ where: { id } });
  if (!existing || existing.employeeId !== employee.id) {
    return res.status(404).json({ error: "Tool request not found" });
  }

  const deleted = await prisma.toolRequest.deleteMany({
    where: { id, employeeId: employee.id, status: { not: "ISSUED" }, checkouts: { none: {} } },
  });
  if (deleted.count === 0) {
    return res
      .status(409)
      .json({ error: "Tools have been issued against this request, so it is kept as a record and can't be deleted" });
  }
  res.status(204).end();
});

/** Hands out the chosen tools: one checkout per tool, each tool marked checked out, request marked issued. */
router.post("/:id/issue", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { toolIds: rawToolIds, expectedReturnAt, note } = req.body ?? {};

  const toolIds = parseToolIds(rawToolIds);
  if (!toolIds) return res.status(400).json({ error: "Choose at least one tool to issue" });

  let expectedReturnDate: Date | null = null;
  if (expectedReturnAt !== undefined && expectedReturnAt !== null && expectedReturnAt !== "") {
    expectedReturnDate = parseDateOnly(expectedReturnAt);
    if (!expectedReturnDate) return res.status(400).json({ error: "Invalid expected return date" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const request = await tx.toolRequest.findUnique({ where: { id } });
      if (!request) throw new IssueError(404, "Tool request not found");

      // Conditional updates, so two storekeepers acting at once can't both issue the same
      // request or the same tool.
      const claimed = await tx.toolRequest.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "ISSUED",
          reviewedById: req.user!.sub,
          reviewedAt: new Date(),
          reviewNote: typeof note === "string" && note.trim() ? note.trim() : null,
        },
      });
      if (claimed.count === 0) throw new IssueError(409, `Request is already ${request.status.toLowerCase()}`);

      const taken = await tx.tool.updateMany({
        where: { id: { in: toolIds }, status: "AVAILABLE" },
        data: { status: "CHECKED_OUT" },
      });
      if (taken.count !== toolIds.length) {
        throw new IssueError(409, "One or more of the chosen tools is no longer available - refresh and choose again");
      }

      await tx.toolCheckout.createMany({
        data: toolIds.map((toolId) => ({
          toolId,
          employeeId: request.employeeId,
          requestId: id,
          issuedById: req.user!.sub,
          expectedReturnAt: expectedReturnDate,
        })),
      });
    });
  } catch (err) {
    if (err instanceof IssueError) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  const request = await prisma.toolRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
  await notifyEmployee(
    request.employeeId,
    "TOOL_REQUEST_ISSUED",
    `Your tool request ${formatToolRequestNumber(request.sequenceNumber)} is ready to collect`,
    {
      message: request.checkouts.map((c) => `${formatToolNumber(c.tool.sequenceNumber)} ${c.tool.name}`).join(", "),
      link: "/dashboard/store/requests",
    },
  );
  res.json({ request: serializeRequest(request) });
});

router.post("/:id/reject", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};
  const reviewNote = typeof note === "string" && note.trim() ? note.trim() : null;

  const existing = await prisma.toolRequest.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Tool request not found" });

  const updated = await prisma.toolRequest.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "REJECTED", reviewedById: req.user!.sub, reviewedAt: new Date(), reviewNote },
  });
  if (updated.count === 0) {
    return res.status(409).json({ error: `Request is already ${existing.status.toLowerCase()}` });
  }

  const request = await prisma.toolRequest.findUniqueOrThrow({ where: { id }, include: requestInclude });
  await notifyEmployee(
    request.employeeId,
    "TOOL_REQUEST_REJECTED",
    `Your tool request ${formatToolRequestNumber(request.sequenceNumber)} was not approved`,
    { message: reviewNote ?? undefined, link: "/dashboard/store/requests" },
  );
  res.json({ request: serializeRequest(request) });
});

export default router;
