import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { generateQuotationPdf } from "../lib/pdf/quotationPdf";
import { SALES_ROLES, NON_FIELD_ROLES } from "../lib/roles";
import { notifyUser } from "../lib/notifications";

const router = Router();
const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
type QuotationStatus = (typeof STATUSES)[number];

// ACCEPTED/REJECTED/EXPIRED are terminal — without this, nothing stopped a PATCH from moving a
// quotation back out of a decided state (e.g. REJECTED -> ACCEPTED), which is a real-record-
// integrity risk since acceptance re-fires the QUOTATION_ACCEPTED notification each time.
const ALLOWED_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED", "EXPIRED"],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

interface QuotationItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

const CUSTOMER_SELECT = { id: true, name: true, company: true, address: true, email: true, phone: true, vatNumber: true, taxNumber: true };

router.use(requireAuth, requireRole(...NON_FIELD_ROLES));

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

/* ------------------------------------------------------------------ *
 * Quote requests (Technet Connect) - must be declared before GET /:id,
 * otherwise Express would match "quote-requests" as an :id.
 * ------------------------------------------------------------------ */

router.get("/quote-requests", requireRole(...SALES_ROLES), async (req, res) => {
  const { status } = req.query;
  const where: Prisma.QuotationRequestWhereInput = {};
  if (typeof status === "string" && ["PENDING", "CONVERTED", "DECLINED"].includes(status)) {
    where.status = status as "PENDING" | "CONVERTED" | "DECLINED";
  }

  const requests = await prisma.quotationRequest.findMany({
    where,
    include: { customer: { select: CUSTOMER_SELECT }, convertedQuotation: { select: { id: true, quotationNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ requests });
});

router.post("/quote-requests/:id/convert", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { quotationNumber, title, vatRate, expiresAt, items } = req.body ?? {};

  const request = await prisma.quotationRequest.findUnique({ where: { id } });
  if (!request) return res.status(404).json({ error: "Quote request not found" });
  if (request.status !== "PENDING") {
    return res.status(400).json({ error: `This request was already ${request.status.toLowerCase()}` });
  }

  if (typeof quotationNumber !== "string" || !quotationNumber.trim()) {
    return res.status(400).json({ error: "Quotation number is required" });
  }
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
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
        customerId: request.customerId,
        quotationNumber: quotationNumber.trim(),
        title: title.trim(),
        status: "DRAFT",
        vatRate: rate,
        subtotal,
        vatAmount,
        total,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: req.user!.sub,
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

    await prisma.quotationRequest.update({
      where: { id },
      data: { status: "CONVERTED", convertedQuotationId: quotation.id, reviewedById: req.user!.sub },
    });

    res.status(201).json({ quotation });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "A quotation with that number already exists" });
    throw err;
  }
});

router.post("/quote-requests/:id/decline", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { note } = req.body ?? {};

  const request = await prisma.quotationRequest.findUnique({ where: { id } });
  if (!request) return res.status(404).json({ error: "Quote request not found" });
  if (request.status !== "PENDING") {
    return res.status(400).json({ error: `This request was already ${request.status.toLowerCase()}` });
  }

  const updated = await prisma.quotationRequest.update({
    where: { id },
    data: {
      status: "DECLINED",
      reviewedById: req.user!.sub,
      reviewNote: typeof note === "string" && note.trim() ? note.trim() : null,
    },
  });
  res.json({ request: updated });
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

router.post("/", requireRole(...SALES_ROLES), async (req, res) => {
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
        createdById: req.user!.sub,
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

router.patch("/:id", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { title, status, expiresAt } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  if (status !== undefined) {
    const current = await prisma.quotation.findUnique({ where: { id }, select: { status: true } });
    if (!current) return res.status(404).json({ error: "Quotation not found" });
    if (!ALLOWED_TRANSITIONS[current.status].includes(status)) {
      return res.status(400).json({ error: `Cannot move a quotation from ${current.status} to ${status}` });
    }
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
    if (quotation.createdById && (status === "ACCEPTED" || status === "REJECTED")) {
      await notifyUser(
        quotation.createdById,
        status === "ACCEPTED" ? "QUOTATION_ACCEPTED" : "QUOTATION_REJECTED",
        `Quotation ${quotation.quotationNumber} was ${status === "ACCEPTED" ? "accepted" : "rejected"}`,
        { link: `/dashboard/erp/finance/quotations/${quotation.id}` },
      );
    }
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

router.delete("/:id", requireRole(...SALES_ROLES), async (req, res) => {
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
