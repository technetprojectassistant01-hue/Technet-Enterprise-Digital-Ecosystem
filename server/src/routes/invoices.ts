import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isUniqueConstraintError, isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { generateInvoicePdf } from "../lib/pdf/invoicePdf";

const router = Router();
const STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;
type InvoiceStatus = (typeof STATUSES)[number];

interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

const CUSTOMER_SELECT = { id: true, name: true, company: true, address: true, email: true, phone: true, vatNumber: true, taxNumber: true };

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
    include: { customer: { select: CUSTOMER_SELECT }, items: true },
    orderBy: { issueDate: "desc" },
  });
  res.json({ invoices });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { customer: { select: CUSTOMER_SELECT }, items: true },
  });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  res.json({ invoice });
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { customerId, projectId, invoiceNumber, status, vatRate, issueDate, dueDate, poReference, terms, items } = req.body ?? {};

  if (typeof customerId !== "string" || !customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }
  if (typeof invoiceNumber !== "string" || !invoiceNumber.trim()) {
    return res.status(400).json({ error: "Invoice number is required" });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  if (vatRate !== undefined && (!Number.isFinite(vatRate) || vatRate < 0)) {
    return res.status(400).json({ error: "VAT rate must be a non-negative number" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "At least one line item is required" });
  }
  for (const item of items as InvoiceItemInput[]) {
    if (typeof item.description !== "string" || !item.description.trim()) {
      return res.status(400).json({ error: "Every line item needs a description" });
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return res.status(400).json({ error: "Every line item needs a positive quantity" });
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
      return res.status(400).json({ error: "Every line item needs a positive unit price" });
    }
  }

  const rate = vatRate !== undefined ? Number(vatRate) : 15;
  const subtotal = (items as InvoiceItemInput[]).reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const vatAmount = subtotal * (rate / 100);
  const total = subtotal + vatAmount;

  try {
    const invoice = await prisma.invoice.create({
      data: {
        customerId,
        projectId: typeof projectId === "string" && projectId ? projectId : null,
        invoiceNumber: invoiceNumber.trim(),
        status: (status as InvoiceStatus) || "DRAFT",
        vatRate: rate,
        subtotal,
        vatAmount,
        total,
        poReference: typeof poReference === "string" && poReference.trim() ? poReference.trim() : null,
        terms: typeof terms === "string" && terms.trim() ? terms.trim() : null,
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        paidAt: status === "PAID" ? new Date() : null,
        items: {
          create: (items as InvoiceItemInput[]).map((item) => ({
            description: item.description.trim(),
            quantity: Math.trunc(item.quantity),
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: { customer: { select: CUSTOMER_SELECT }, items: true },
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
  const { status, dueDate, projectId, poReference, terms } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const data: Prisma.InvoiceUpdateInput = {};
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (projectId !== undefined) data.project = projectId ? { connect: { id: projectId } } : { disconnect: true };
  if (poReference !== undefined) data.poReference = poReference || null;
  if (terms !== undefined) data.terms = terms || null;
  if (status !== undefined) {
    data.status = status as InvoiceStatus;
    data.paidAt = status === "PAID" ? new Date() : null;
  }

  try {
    const invoice = await prisma.invoice.update({
      where: { id },
      data,
      include: { customer: { select: CUSTOMER_SELECT }, items: true },
    });
    res.json({ invoice });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Invoice not found" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Project not found" });
    throw err;
  }
});

router.get("/:id/pdf", async (req, res) => {
  const id = req.params.id as string;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { customer: { select: CUSTOMER_SELECT }, items: true },
  });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });

  const doc = generateInvoicePdf(invoice);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);
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
