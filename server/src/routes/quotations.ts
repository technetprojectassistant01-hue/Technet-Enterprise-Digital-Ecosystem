import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { generateQuotationPdf } from "../lib/pdf/quotationPdf";

const router = Router();
const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
type QuotationStatus = (typeof STATUSES)[number];

interface QuotationItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

const CUSTOMER_SELECT = { id: true, name: true, company: true, address: true, email: true, phone: true, vatNumber: true, taxNumber: true };

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { status } = req.query;

  const where: Prisma.QuotationWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as QuotationStatus)) {
    where.status = status as QuotationStatus;
  }

  const quotations = await prisma.quotation.findMany({
    where,
    include: { customer: { select: CUSTOMER_SELECT }, items: true },
    orderBy: { issuedAt: "desc" },
  });
  res.json({ quotations });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { customer: { select: CUSTOMER_SELECT }, items: true },
  });
  if (!quotation) return res.status(404).json({ error: "Quotation not found" });
  res.json({ quotation });
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { customerId, quotationNumber, title, status, vatRate, expiresAt, items } = req.body ?? {};

  if (typeof customerId !== "string" || !customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }
  if (typeof quotationNumber !== "string" || !quotationNumber.trim()) {
    return res.status(400).json({ error: "Quotation number is required" });
  }
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
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
  for (const item of items as QuotationItemInput[]) {
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
  const subtotal = (items as QuotationItemInput[]).reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const vatAmount = subtotal * (rate / 100);
  const total = subtotal + vatAmount;

  try {
    const quotation = await prisma.quotation.create({
      data: {
        customerId,
        quotationNumber: quotationNumber.trim(),
        title: title.trim(),
        status: (status as QuotationStatus) || "DRAFT",
        vatRate: rate,
        subtotal,
        vatAmount,
        total,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        items: {
          create: (items as QuotationItemInput[]).map((item) => ({
            description: item.description.trim(),
            quantity: Math.trunc(item.quantity),
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: { customer: { select: CUSTOMER_SELECT }, items: true },
    });
    res.status(201).json({ quotation });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "A quotation with that number already exists" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer not found" });
    throw err;
  }
});

router.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { title, status, expiresAt } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const data: Prisma.QuotationUpdateInput = {};
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if (status !== undefined) data.status = status as QuotationStatus;
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;

  try {
    const quotation = await prisma.quotation.update({
      where: { id },
      data,
      include: { customer: { select: CUSTOMER_SELECT }, items: true },
    });
    res.json({ quotation });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Quotation not found" });
    throw err;
  }
});

router.get("/:id/pdf", async (req, res) => {
  const id = req.params.id as string;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { customer: { select: CUSTOMER_SELECT }, items: true },
  });
  if (!quotation) return res.status(404).json({ error: "Quotation not found" });

  const author = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { name: true, email: true } });
  const signatoryName = author?.name || author?.email || "Technet Engineering Ltd";

  const doc = generateQuotationPdf(quotation, signatoryName);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${quotation.quotationNumber}.pdf"`);
  doc.pipe(res);
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.quotation.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Quotation not found" });
    throw err;
  }
});

export default router;
