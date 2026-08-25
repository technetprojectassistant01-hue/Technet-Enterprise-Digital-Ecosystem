import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { generateQuotationPdf } from "../lib/pdf/quotationPdf";
import { generateQuotationNumber } from "../lib/quotationNumber";
import { SALES_ROLES, QUOTE_REQUEST_VIEW_ROLES, NON_FIELD_ROLES } from "../lib/roles";
import { notifyUser } from "../lib/notifications";

const router = Router();
const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
type QuotationStatus = (typeof STATUSES)[number];

const PAYMENT_TERMS = ["FULL_ON_CONFIRMATION", "SPLIT_60_40_20", "SPLIT_50_50"] as const;
type PaymentTerms = (typeof PAYMENT_TERMS)[number];

const AVAILABILITY_STATUSES = ["IN_STOCK", "ORDER_PENDING"] as const;
type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

const REQUEST_SOURCES = ["EMAIL", "PHONE_CALL", "REFERRER"] as const;
const REQUEST_CATEGORIES = [
  "NEW_EQUIPMENT_INSTALL",
  "AC_INSTALL",
  "PLUMBING_INSTALL",
  "ELECTRICAL_INSTALL",
  "SERVICING",
  "REPAIRS",
  "OTHER",
] as const;

export const QUOTATION_FOLLOWUP_OUTCOMES = [
  "CALL_BACK",
  "DECISION_NOT_YET_TAKEN",
  "DECISION_MAKER_OUT_OF_COUNTRY",
  "PRICE_NOT_COMPETITIVE",
  "REVIEW_OTHER_FEATURES",
  "REVIEW_PRICE",
  "DELIVERY_DATE_NOT_ACCEPTED",
  "QUOTATION_NOT_APPROVED",
  "NOT_IN_BUDGET",
] as const;

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

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[0]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateItems(items: unknown): { error: string } | { items: QuotationItemInput[] } {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "At least one line item is required" };
  }
  for (const item of items as QuotationItemInput[]) {
    if (typeof item.description !== "string" || !item.description.trim()) {
      return { error: "Every line item needs a description" };
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return { error: "Every line item needs a positive quantity" };
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
      return { error: "Every line item needs a positive unit price" };
    }
  }
  return { items: items as QuotationItemInput[] };
}

interface QuotationExtras {
  paymentTerms: PaymentTerms;
  availabilityStatus: AvailabilityStatus | null;
  orderDays: number | null;
}

function parseQuotationExtras(body: {
  paymentTerms?: unknown;
  availabilityStatus?: unknown;
  orderDays?: unknown;
}): { error: string } | QuotationExtras {
  const paymentTerms =
    body.paymentTerms !== undefined && body.paymentTerms !== null ? body.paymentTerms : "FULL_ON_CONFIRMATION";
  if (!PAYMENT_TERMS.includes(paymentTerms as PaymentTerms)) {
    return { error: "Invalid payment terms" };
  }

  if (body.availabilityStatus === undefined || body.availabilityStatus === null || body.availabilityStatus === "") {
    return { paymentTerms: paymentTerms as PaymentTerms, availabilityStatus: null, orderDays: null };
  }
  if (!AVAILABILITY_STATUSES.includes(body.availabilityStatus as AvailabilityStatus)) {
    return { error: "Invalid availability status" };
  }
  if (body.availabilityStatus === "ORDER_PENDING") {
    if (!Number.isFinite(body.orderDays) || (body.orderDays as number) <= 0) {
      return { error: "Enter how many days until the order is received" };
    }
    return {
      paymentTerms: paymentTerms as PaymentTerms,
      availabilityStatus: "ORDER_PENDING",
      orderDays: Math.trunc(body.orderDays as number),
    };
  }
  return { paymentTerms: paymentTerms as PaymentTerms, availabilityStatus: "IN_STOCK", orderDays: null };
}

/** Retries on a quotation-number collision (two near-simultaneous creates same day) - real volume
 * here is a handful a day, so a short retry loop is simpler than a dedicated sequence table. */
async function createWithGeneratedNumber<T>(build: (quotationNumber: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const quotationNumber = await generateQuotationNumber();
    try {
      return await build(quotationNumber);
    } catch (err) {
      if (isUniqueConstraintError(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("Failed to generate a unique quotation number");
}

router.use(requireAuth, requireRole(...NON_FIELD_ROLES));

router.get("/", async (req, res) => {
  const { status, from, to } = req.query;

  const where: Prisma.QuotationWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as QuotationStatus)) {
    where.status = status as QuotationStatus;
  }
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (fromDate || toDate) {
    where.issuedAt = {};
    if (fromDate) where.issuedAt.gte = fromDate;
    if (toDate) where.issuedAt.lte = new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  const quotations = await prisma.quotation.findMany({
    where,
    include: { customer: { select: CUSTOMER_SELECT }, items: true },
    orderBy: { issuedAt: "desc" },
  });
  res.json({ quotations });
});

/* ------------------------------------------------------------------ *
 * Quote requests (Technet Connect portal + manual staff intake) - must
 * be declared before GET /:id, otherwise Express would match
 * "quote-requests" as an :id.
 * ------------------------------------------------------------------ */

router.get("/quote-requests", requireRole(...QUOTE_REQUEST_VIEW_ROLES), async (req, res) => {
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

/** Manual staff intake ("Client Request Form") - a call/email/referral logged before pricing exists.
 * Distinct from the portal's own POST /api/portal/quote-requests, which always sets source=PORTAL
 * and never reaches this route. */
router.post("/quote-requests", requireRole(...SALES_ROLES), async (req, res) => {
  const {
    customerId,
    companyName,
    contactEmail,
    contactPhone,
    contactTitle,
    otherContactName,
    otherContactPhone,
    source,
    requestFor,
    requestForOther,
    description,
    remarks,
  } = req.body ?? {};

  const hasCustomer = typeof customerId === "string" && customerId;
  const hasCompanyName = typeof companyName === "string" && companyName.trim();
  if (!hasCustomer && !hasCompanyName) {
    return res.status(400).json({ error: "Select an existing customer or enter a company name" });
  }
  if (!REQUEST_SOURCES.includes(source)) {
    return res.status(400).json({ error: "Source must be email, phone call, or referrer" });
  }
  if (requestFor !== undefined && requestFor !== null && requestFor !== "" && !REQUEST_CATEGORIES.includes(requestFor)) {
    return res.status(400).json({ error: "Invalid request category" });
  }
  if (requestFor === "OTHER" && (typeof requestForOther !== "string" || !requestForOther.trim())) {
    return res.status(400).json({ error: "Describe the request when choosing Other" });
  }
  if (typeof description !== "string" || !description.trim()) {
    return res.status(400).json({ error: "Description is required" });
  }

  try {
    const request = await prisma.quotationRequest.create({
      data: {
        customerId: hasCustomer ? customerId : null,
        companyName: hasCustomer ? null : (companyName as string).trim(),
        contactEmail: typeof contactEmail === "string" && contactEmail ? contactEmail : null,
        contactPhone: typeof contactPhone === "string" && contactPhone ? contactPhone : null,
        contactTitle: typeof contactTitle === "string" && contactTitle ? contactTitle : null,
        otherContactName: typeof otherContactName === "string" && otherContactName ? otherContactName : null,
        otherContactPhone: typeof otherContactPhone === "string" && otherContactPhone ? otherContactPhone : null,
        source,
        requestFor: requestFor || null,
        requestForOther: requestFor === "OTHER" ? (requestForOther as string).trim() : null,
        description: description.trim(),
        remarks: typeof remarks === "string" && remarks.trim() ? remarks.trim() : null,
      },
      include: { customer: { select: CUSTOMER_SELECT } },
    });
    res.status(201).json({ request });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer not found" });
    throw err;
  }
});

router.post("/quote-requests/:id/convert", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const {
    customerId: bodyCustomerId,
    title,
    contactPerson,
    vatRate,
    expiresAt,
    items,
    paymentTerms,
    availabilityStatus,
    orderDays,
  } = req.body ?? {};

  const request = await prisma.quotationRequest.findUnique({ where: { id } });
  if (!request) return res.status(404).json({ error: "Quote request not found" });
  if (request.status !== "PENDING") {
    return res.status(400).json({ error: `This request was already ${request.status.toLowerCase()}` });
  }

  const customerId = request.customerId || (typeof bodyCustomerId === "string" && bodyCustomerId ? bodyCustomerId : null);
  if (!customerId) {
    return res.status(400).json({ error: "This request has no linked customer yet - select or create one before converting" });
  }

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  if (vatRate !== undefined && (!Number.isFinite(vatRate) || vatRate < 0)) {
    return res.status(400).json({ error: "VAT rate must be a non-negative number" });
  }
  const itemsResult = validateItems(items);
  if ("error" in itemsResult) return res.status(400).json({ error: itemsResult.error });
  const extras = parseQuotationExtras({ paymentTerms, availabilityStatus, orderDays });
  if ("error" in extras) return res.status(400).json({ error: extras.error });

  const rate = vatRate !== undefined ? Number(vatRate) : 15;
  const subtotal = itemsResult.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const vatAmount = subtotal * (rate / 100);
  const total = subtotal + vatAmount;

  try {
    const quotation = await createWithGeneratedNumber((quotationNumber) =>
      prisma.quotation.create({
        data: {
          customerId,
          quotationNumber,
          title: title.trim(),
          contactPerson: typeof contactPerson === "string" && contactPerson.trim() ? contactPerson.trim() : null,
          status: "DRAFT",
          vatRate: rate,
          subtotal,
          vatAmount,
          total,
          paymentTerms: extras.paymentTerms,
          availabilityStatus: extras.availabilityStatus,
          orderDays: extras.orderDays,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdById: req.user!.sub,
          items: {
            create: itemsResult.items.map((item) => ({
              description: item.description.trim(),
              quantity: Math.trunc(item.quantity),
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: { customer: { select: CUSTOMER_SELECT }, items: true },
      }),
    );

    await prisma.quotationRequest.update({
      where: { id },
      data: { status: "CONVERTED", convertedQuotationId: quotation.id, reviewedById: req.user!.sub },
    });

    res.status(201).json({ quotation });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer not found" });
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
  const { customerId, title, contactPerson, vatRate, expiresAt, items, paymentTerms, availabilityStatus, orderDays } =
    req.body ?? {};

  if (typeof customerId !== "string" || !customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  if (vatRate !== undefined && (!Number.isFinite(vatRate) || vatRate < 0)) {
    return res.status(400).json({ error: "VAT rate must be a non-negative number" });
  }
  const itemsResult = validateItems(items);
  if ("error" in itemsResult) return res.status(400).json({ error: itemsResult.error });
  const extras = parseQuotationExtras({ paymentTerms, availabilityStatus, orderDays });
  if ("error" in extras) return res.status(400).json({ error: extras.error });

  const rate = vatRate !== undefined ? Number(vatRate) : 15;
  const subtotal = itemsResult.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const vatAmount = subtotal * (rate / 100);
  const total = subtotal + vatAmount;

  try {
    const quotation = await createWithGeneratedNumber((quotationNumber) =>
      prisma.quotation.create({
        data: {
          customerId,
          quotationNumber,
          title: title.trim(),
          contactPerson: typeof contactPerson === "string" && contactPerson.trim() ? contactPerson.trim() : null,
          status: "DRAFT",
          vatRate: rate,
          subtotal,
          vatAmount,
          total,
          paymentTerms: extras.paymentTerms,
          availabilityStatus: extras.availabilityStatus,
          orderDays: extras.orderDays,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdById: req.user!.sub,
          items: {
            create: itemsResult.items.map((item) => ({
              description: item.description.trim(),
              quantity: Math.trunc(item.quantity),
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: { customer: { select: CUSTOMER_SELECT }, items: true },
      }),
    );
    res.status(201).json({ quotation });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer not found" });
    throw err;
  }
});

router.patch("/:id", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const {
    title,
    contactPerson,
    status,
    expiresAt,
    poReference,
    customerId,
    vatRate,
    paymentTerms,
    availabilityStatus,
    orderDays,
    items,
  } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const current = await prisma.quotation.findUnique({ where: { id }, include: { items: true } });
  if (!current) return res.status(404).json({ error: "Quotation not found" });

  if (status !== undefined && !ALLOWED_TRANSITIONS[current.status].includes(status)) {
    return res.status(400).json({ error: `Cannot move a quotation from ${current.status} to ${status}` });
  }

  // Customer, pricing, and line items are only editable while still a Draft - once sent, the
  // document has gone to the customer and shouldn't silently change underneath them.
  const editingDraftOnlyFields =
    customerId !== undefined ||
    vatRate !== undefined ||
    paymentTerms !== undefined ||
    availabilityStatus !== undefined ||
    orderDays !== undefined ||
    items !== undefined;
  if (editingDraftOnlyFields && current.status !== "DRAFT") {
    return res
      .status(400)
      .json({ error: "Only draft quotations can have their customer, pricing, or line items edited" });
  }

  const data: Prisma.QuotationUpdateInput = {};
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if (contactPerson !== undefined) data.contactPerson = typeof contactPerson === "string" && contactPerson.trim() ? contactPerson.trim() : null;
  if (status !== undefined) data.status = status as QuotationStatus;
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
  if (poReference !== undefined) data.poReference = typeof poReference === "string" && poReference.trim() ? poReference.trim() : null;
  if (customerId !== undefined) {
    if (typeof customerId !== "string" || !customerId) return res.status(400).json({ error: "customerId is required" });
    data.customer = { connect: { id: customerId } };
  }

  let newItems: QuotationItemInput[] | undefined;
  if (items !== undefined) {
    const itemsResult = validateItems(items);
    if ("error" in itemsResult) return res.status(400).json({ error: itemsResult.error });
    newItems = itemsResult.items;
  }
  if (paymentTerms !== undefined || availabilityStatus !== undefined || orderDays !== undefined) {
    const extras = parseQuotationExtras({ paymentTerms, availabilityStatus, orderDays });
    if ("error" in extras) return res.status(400).json({ error: extras.error });
    data.paymentTerms = extras.paymentTerms;
    data.availabilityStatus = extras.availabilityStatus;
    data.orderDays = extras.orderDays;
  }
  if (vatRate !== undefined && (!Number.isFinite(vatRate) || vatRate < 0)) {
    return res.status(400).json({ error: "VAT rate must be a non-negative number" });
  }

  // Recompute totals if the line items or VAT rate changed.
  if (newItems || vatRate !== undefined) {
    const effectiveItems: QuotationItemInput[] =
      newItems ||
      current.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: Number(i.unitPrice) }));
    const effectiveRate = vatRate !== undefined ? Number(vatRate) : Number(current.vatRate);
    const subtotal = effectiveItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const vatAmount = subtotal * (effectiveRate / 100);
    data.vatRate = effectiveRate;
    data.subtotal = subtotal;
    data.vatAmount = vatAmount;
    data.total = subtotal + vatAmount;
    if (newItems) {
      data.items = {
        deleteMany: {},
        create: newItems.map((item) => ({
          description: item.description.trim(),
          quantity: Math.trunc(item.quantity),
          unitPrice: item.unitPrice,
        })),
      };
    }
  }

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
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer not found" });
    throw err;
  }
});

/* ------------------------------------------------------------------ *
 * Follow-Up of Quotation - call history chasing a client after a
 * quotation has gone out.
 * ------------------------------------------------------------------ */

router.get("/:id/follow-ups", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const followUps = await prisma.quotationFollowUp.findMany({
    where: { quotationId: id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
    orderBy: { calledAt: "desc" },
  });
  res.json({ followUps });
});

router.post("/:id/follow-ups", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { calledAt, spokenTo, outcome, callScheduledOn } = req.body ?? {};

  const quotation = await prisma.quotation.findUnique({ where: { id }, select: { id: true } });
  if (!quotation) return res.status(404).json({ error: "Quotation not found" });

  if (typeof spokenTo !== "string" || !spokenTo.trim()) {
    return res.status(400).json({ error: "Who was spoken to is required" });
  }
  if (!QUOTATION_FOLLOWUP_OUTCOMES.includes(outcome)) {
    return res.status(400).json({ error: "Invalid outcome" });
  }
  if (outcome === "CALL_BACK" && !callScheduledOn) {
    return res.status(400).json({ error: "Call schedule date is required when the outcome is 'call back'" });
  }

  const followUp = await prisma.quotationFollowUp.create({
    data: {
      quotationId: id,
      calledAt: calledAt ? new Date(calledAt) : undefined,
      spokenTo: spokenTo.trim(),
      outcome,
      callScheduledOn: callScheduledOn ? new Date(callScheduledOn) : null,
      createdById: req.user!.sub,
    },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  res.status(201).json({ followUp });
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
