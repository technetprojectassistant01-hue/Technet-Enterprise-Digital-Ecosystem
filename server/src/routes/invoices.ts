import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isUniqueConstraintError, isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";

const router = Router();
const STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;
type InvoiceStatus = (typeof STATUSES)[number];

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { status, projectId } = req.query;

  const where: Prisma.InvoiceWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as InvoiceStatus)) {
    where.status = status as InvoiceStatus;
  }
  if (typeof projectId === "string" && projectId) {
    where.projectId = projectId;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { customer: { select: { id: true, name: true, company: true } } },
    orderBy: { issueDate: "desc" },
  });
  res.json({ invoices });
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { customerId, projectId, invoiceNumber, amount, status, issueDate, dueDate } = req.body ?? {};

  if (typeof customerId !== "string" || !customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }
  if (typeof invoiceNumber !== "string" || !invoiceNumber.trim()) {
    return res.status(400).json({ error: "Invoice number is required" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const invoice = await prisma.invoice.create({
      data: {
        customerId,
        projectId: typeof projectId === "string" && projectId ? projectId : null,
        invoiceNumber: invoiceNumber.trim(),
        amount,
        status: (status as InvoiceStatus) || "DRAFT",
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        paidAt: status === "PAID" ? new Date() : null,
      },
      include: { customer: { select: { id: true, name: true, company: true } } },
    });
    res.status(201).json({ invoice });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "An invoice with that number already exists" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer or project not found" });
    throw err;
  }
});

router.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { invoiceNumber, amount, status, dueDate, projectId } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  const data: Prisma.InvoiceUpdateInput = {};
  if (typeof invoiceNumber === "string" && invoiceNumber.trim()) data.invoiceNumber = invoiceNumber.trim();
  if (amount !== undefined) data.amount = amount;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (projectId !== undefined) data.project = projectId ? { connect: { id: projectId } } : { disconnect: true };
  if (status !== undefined) {
    data.status = status as InvoiceStatus;
    data.paidAt = status === "PAID" ? new Date() : null;
  }

  try {
    const invoice = await prisma.invoice.update({
      where: { id },
      data,
      include: { customer: { select: { id: true, name: true, company: true } } },
    });
    res.json({ invoice });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Invoice not found" });
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "An invoice with that number already exists" });
    throw err;
  }
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.invoice.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Invoice not found" });
    throw err;
  }
});

export default router;
