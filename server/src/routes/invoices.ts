import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
const STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;
type InvoiceStatus = (typeof STATUSES)[number];

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { status } = req.query;

  const where: Prisma.InvoiceWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as InvoiceStatus)) {
    where.status = status as InvoiceStatus;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { customer: { select: { id: true, name: true, company: true } } },
    orderBy: { issueDate: "desc" },
  });
  res.json({ invoices });
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { customerId, invoiceNumber, amount, status, issueDate, dueDate } = req.body ?? {};

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
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return res.status(409).json({ error: "An invoice with that number already exists" });
      if (err.code === "P2003") return res.status(400).json({ error: "Customer not found" });
    }
    throw err;
  }
});

router.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { invoiceNumber, amount, status, dueDate } = req.body ?? {};

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
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return res.status(404).json({ error: "Invoice not found" });
      if (err.code === "P2002") return res.status(409).json({ error: "An invoice with that number already exists" });
    }
    throw err;
  }
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.invoice.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ error: "Invoice not found" });
    }
    throw err;
  }
});

export default router;
