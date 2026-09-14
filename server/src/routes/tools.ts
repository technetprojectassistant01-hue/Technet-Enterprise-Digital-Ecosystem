import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { TOOL_MANAGE_ROLES } from "../lib/roles";
import {
  MANUAL_TOOL_STATUSES,
  TOOL_CONDITIONS,
  TOOL_STATUSES,
  formatToolNumber,
  formatToolRequestNumber,
  statusAfterReturn,
  type ToolConditionValue,
  type ToolStatusValue,
} from "../lib/tools";

/**
 * Technet Store - the tools & equipment register. Every signed-in user can see the register
 * (a technician checks what exists and what they hold); only TOOL_MANAGE_ROLES add, edit, delete
 * and record returns. Tools are handed out through tool requests (toolRequests.ts), never here.
 */
const router = Router();

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, employeeCode: true };

const toolInclude = {
  // The open checkout, if any - who holds the tool right now.
  checkouts: {
    where: { returnedAt: null },
    include: { employee: { select: EMPLOYEE_SELECT } },
    take: 1,
  },
} satisfies Prisma.ToolInclude;

type ToolWithOpenCheckout = Prisma.ToolGetPayload<{ include: typeof toolInclude }>;

function serializeTool(tool: ToolWithOpenCheckout) {
  const { checkouts, ...rest } = tool;
  return { ...rest, toolNumber: formatToolNumber(tool.sequenceNumber), currentCheckout: checkouts[0] ?? null };
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { search, status, category, holderEmployeeId } = req.query;

  const where: Prisma.ToolWhereInput = {};
  if (typeof search === "string" && search.trim()) {
    const term = search.trim();
    const or: Prisma.ToolWhereInput[] = [
      { name: { contains: term, mode: "insensitive" } },
      { serialNumber: { contains: term, mode: "insensitive" } },
      { location: { contains: term, mode: "insensitive" } },
    ];
    const tag = /^(?:TL-?)?0*(\d+)$/i.exec(term);
    if (tag) or.push({ sequenceNumber: Number(tag[1]) });
    where.OR = or;
  }
  if (typeof status === "string" && TOOL_STATUSES.includes(status as ToolStatusValue)) {
    where.status = status as ToolStatusValue;
  }
  if (typeof category === "string" && category) {
    where.category = { equals: category, mode: "insensitive" };
  }
  if (typeof holderEmployeeId === "string" && holderEmployeeId) {
    where.checkouts = { some: { employeeId: holderEmployeeId, returnedAt: null } };
  }

  const tools = await prisma.tool.findMany({ where, include: toolInclude, orderBy: { sequenceNumber: "asc" } });
  res.json({ tools: tools.map(serializeTool) });
});

/** Tools the signed-in user currently holds. Empty (not an error) when the login has no employee record. */
router.get("/mine", async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub }, select: { id: true } });
  if (!employee) return res.json({ checkouts: [] });

  const checkouts = await prisma.toolCheckout.findMany({
    where: { employeeId: employee.id, returnedAt: null },
    include: { tool: true },
    orderBy: { issuedAt: "desc" },
  });
  res.json({
    checkouts: checkouts.map((c) => ({ ...c, tool: { ...c.tool, toolNumber: formatToolNumber(c.tool.sequenceNumber) } })),
  });
});

/** Everyone who has had this tool, newest first. */
router.get("/:id/history", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const checkouts = await prisma.toolCheckout.findMany({
    where: { toolId: id },
    include: {
      employee: { select: EMPLOYEE_SELECT },
      issuedBy: { select: { id: true, name: true, email: true } },
      returnedBy: { select: { id: true, name: true, email: true } },
      request: { select: { id: true, sequenceNumber: true } },
    },
    orderBy: { issuedAt: "desc" },
  });
  res.json({
    checkouts: checkouts.map((c) => ({
      ...c,
      request: c.request ? { ...c.request, requestNumber: formatToolRequestNumber(c.request.sequenceNumber) } : null,
    })),
  });
});

router.post("/", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const { name, category, serialNumber, condition, location, notes } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (condition !== undefined && !TOOL_CONDITIONS.includes(condition)) {
    return res.status(400).json({ error: "Invalid condition" });
  }

  try {
    const tool = await prisma.tool.create({
      data: {
        name: name.trim(),
        category: optionalText(category),
        serialNumber: optionalText(serialNumber),
        condition: (condition as ToolConditionValue | undefined) ?? "GOOD",
        location: optionalText(location),
        notes: optionalText(notes),
      },
      include: toolInclude,
    });
    res.status(201).json({ tool: serializeTool(tool) });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "A tool with that serial number already exists" });
    throw err;
  }
});

router.patch("/:id", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { name, category, serialNumber, condition, status, location, notes } = req.body ?? {};

  if (condition !== undefined && !TOOL_CONDITIONS.includes(condition)) {
    return res.status(400).json({ error: "Invalid condition" });
  }
  if (status !== undefined && !MANUAL_TOOL_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Status can only be set to Available, Under repair or Retired" });
  }

  const existing = await prisma.tool.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return res.status(404).json({ error: "Tool not found" });
  if (status !== undefined && existing.status === "CHECKED_OUT") {
    return res.status(409).json({ error: "This tool is checked out - record its return before changing its status" });
  }

  const data: Prisma.ToolUpdateInput = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (category !== undefined) data.category = optionalText(category);
  if (serialNumber !== undefined) data.serialNumber = optionalText(serialNumber);
  if (condition !== undefined) data.condition = condition as ToolConditionValue;
  if (status !== undefined) data.status = status as ToolStatusValue;
  if (location !== undefined) data.location = optionalText(location);
  if (notes !== undefined) data.notes = optionalText(notes);

  try {
    const tool = await prisma.tool.update({ where: { id }, data, include: toolInclude });
    res.json({ tool: serializeTool(tool) });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Tool not found" });
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "A tool with that serial number already exists" });
    throw err;
  }
});

router.delete("/:id", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.tool.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Tool not found" });
    if (isForeignKeyConstraintError(err)) {
      return res
        .status(409)
        .json({ error: "This tool has been issued before, so its history is kept - set its status to Retired instead" });
    }
    throw err;
  }
});

/** Records a tool coming back. The condition it came back in updates the tool; damaged goes to repair. */
router.post("/checkouts/:checkoutId/return", requireRole(...TOOL_MANAGE_ROLES), async (req, res) => {
  const checkoutId = req.params.checkoutId as string;
  const { condition, note } = req.body ?? {};

  if (!TOOL_CONDITIONS.includes(condition)) {
    return res.status(400).json({ error: "Choose the condition the tool came back in" });
  }
  const returnCondition = condition as ToolConditionValue;

  const result = await prisma.$transaction(async (tx) => {
    // Only an open checkout can be closed - guards against two people recording the same return.
    const closed = await tx.toolCheckout.updateMany({
      where: { id: checkoutId, returnedAt: null },
      data: {
        returnedAt: new Date(),
        returnedById: req.user!.sub,
        returnCondition,
        returnNote: optionalText(note),
      },
    });
    if (closed.count === 0) return null;

    const checkout = await tx.toolCheckout.findUniqueOrThrow({ where: { id: checkoutId } });
    return tx.tool.update({
      where: { id: checkout.toolId },
      data: { condition: returnCondition, status: statusAfterReturn(returnCondition) },
      include: toolInclude,
    });
  });

  if (!result) return res.status(404).json({ error: "No open checkout found - it may already have been returned" });
  res.json({ tool: serializeTool(result) });
});

export default router;
