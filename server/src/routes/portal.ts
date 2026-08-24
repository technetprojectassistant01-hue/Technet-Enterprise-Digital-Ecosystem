import { Router } from "express";
import type { QuotationStatus, InvoiceStatus } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requirePortalAuth } from "../middleware/portalAuth";
import { generateQuotationPdf } from "../lib/pdf/quotationPdf";
import { generateInvoicePdf } from "../lib/pdf/invoicePdf";
import { SALES_ROLES } from "../lib/roles";
import { notifyRoles } from "../lib/notifications";

const router = Router();

router.use(requirePortalAuth);

const CUSTOMER_SELECT = { id: true, name: true, company: true, address: true, email: true, phone: true, vatNumber: true, taxNumber: true };

// Drafts are internal work-in-progress, never customer-visible.
const QUOTATION_VISIBLE_STATUSES: QuotationStatus[] = ["SENT", "ACCEPTED", "REJECTED", "EXPIRED"];
const INVOICE_VISIBLE_STATUSES: InvoiceStatus[] = ["SENT", "PAID", "OVERDUE", "CANCELLED"];

router.get("/quotations", async (req, res) => {
  const quotations = await prisma.quotation.findMany({
    where: { customerId: req.portalUser!.customerId, status: { in: QUOTATION_VISIBLE_STATUSES } },
    include: { items: true },
    orderBy: { issuedAt: "desc" },
  });
  res.json({ quotations });
});

router.get("/quotations/:id/pdf", async (req, res) => {
  const id = req.params.id as string;
  // customerId is always taken from the verified token, never trusted from the URL - this is what
  // stops a customer from guessing another customer's quotation id and downloading their PDF.
  const quotation = await prisma.quotation.findFirst({
    where: { id, customerId: req.portalUser!.customerId, status: { in: QUOTATION_VISIBLE_STATUSES } },
    include: { customer: { select: CUSTOMER_SELECT }, items: true },
  });
  if (!quotation) return res.status(404).json({ error: "Quotation not found" });

  const doc = generateQuotationPdf(quotation, "Technet Engineering Ltd");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${quotation.quotationNumber}.pdf"`);
  doc.pipe(res);
});

router.get("/invoices", async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { customerId: req.portalUser!.customerId, status: { in: INVOICE_VISIBLE_STATUSES } },
    include: { items: true },
    orderBy: { issueDate: "desc" },
  });
  res.json({ invoices });
});

router.get("/invoices/:id/pdf", async (req, res) => {
  const id = req.params.id as string;
  const invoice = await prisma.invoice.findFirst({
    where: { id, customerId: req.portalUser!.customerId, status: { in: INVOICE_VISIBLE_STATUSES } },
    include: { customer: { select: CUSTOMER_SELECT }, items: true },
  });
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });

  const doc = generateInvoicePdf(invoice);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);
});

// Deliberately narrow field selection - no siteLat/siteLng (precise GPS, no reason a customer
// needs it), no technicians (staff names), no linked reports (internal detail).
router.get("/work-orders", async (req, res) => {
  const workOrders = await prisma.workOrder.findMany({
    where: { customerId: req.portalUser!.customerId },
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      jobCategory: true,
      description: true,
      status: true,
      scheduledDate: true,
      siteAddress: true,
    },
    orderBy: { scheduledDate: "desc" },
  });
  res.json({ workOrders });
});

router.get("/quote-requests", async (req, res) => {
  const requests = await prisma.quotationRequest.findMany({
    where: { customerId: req.portalUser!.customerId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ requests });
});

router.post("/quote-requests", async (req, res) => {
  const { description } = req.body ?? {};
  if (typeof description !== "string" || !description.trim()) {
    return res.status(400).json({ error: "A description is required" });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: req.portalUser!.customerId },
    select: { name: true, company: true },
  });

  const request = await prisma.quotationRequest.create({
    data: { customerId: req.portalUser!.customerId, description: description.trim() },
  });

  await notifyRoles(
    SALES_ROLES,
    "QUOTATION_REQUEST_SUBMITTED",
    `${customer?.company || customer?.name || "A customer"} requested a quotation`,
    { message: request.description.slice(0, 200), link: "/dashboard/erp/finance/quotations" },
  );

  res.status(201).json({ request });
});

export default router;
