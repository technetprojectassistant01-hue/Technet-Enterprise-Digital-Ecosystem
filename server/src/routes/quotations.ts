import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";

const router = Router();
const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;
type QuotationStatus = (typeof STATUSES)[number];

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { status } = req.query;

  const where: Prisma.QuotationWhereInput = {};
  if (typeof status === "string" && STATUSES.includes(status as QuotationStatus)) {
    where.status = status as QuotationStatus;
  }

  const quotations = await prisma.quotation.findMany({
    where,
    include: { customer: { select: { id: true, name: true, company: true } } },
    orderBy: { issuedAt: "desc" },
  });
  res.json({ quotations });
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { customerId, title, amount, status, expiresAt } = req.body ?? {};

  if (typeof customerId !== "string" || !customerId) {
    return res.status(400).json({ error: "customerId is required" });
  }
  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const quotation = await prisma.quotation.create({
      data: {
        customerId,
        title: title.trim(),
        amount,
        status: (status as QuotationStatus) || "DRAFT",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: { customer: { select: { id: true, name: true, company: true } } },
    });
    res.status(201).json({ quotation });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Customer not found" });
    throw err;
  }
});

router.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { title, amount, status, expiresAt } = req.body ?? {};

  if (status !== undefined && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  const data: Prisma.QuotationUpdateInput = {};
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if (amount !== undefined) data.amount = amount;
  if (status !== undefined) data.status = status as QuotationStatus;
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;

  try {
    const quotation = await prisma.quotation.update({
      where: { id },
      data,
      include: { customer: { select: { id: true, name: true, company: true } } },
    });
    res.json({ quotation });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Quotation not found" });
    throw err;
  }
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
