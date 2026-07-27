import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";

/** A certification inside this window is treated as due for renewal. */
const EXPIRING_SOON_DAYS = 60;

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalDecimal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return new Prisma.Decimal(num.toFixed(2));
}

const employeeSelect = {
  select: { id: true, firstName: true, lastName: true, employeeCode: true, position: true },
};

/* ================================================================== *
 * Certifications
 * ================================================================== */

const router = Router();
router.use(requireAuth, requireRole("ADMIN", "MANAGER"));

router.get("/", async (req, res) => {
  const { employeeId, search, status } = req.query;
  const today = todayUtc();
  const soonCutoff = new Date(today.getTime() + EXPIRING_SOON_DAYS * 86_400_000);

  const where: Prisma.CertificationWhereInput = {};
  if (typeof employeeId === "string" && employeeId) where.employeeId = employeeId;

  if (typeof search === "string" && search.trim()) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { issuingBody: { contains: search, mode: "insensitive" } },
      { certificateNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status === "expired") {
    where.expiryDate = { lt: today };
  } else if (status === "expiring") {
    where.expiryDate = { gte: today, lte: soonCutoff };
  } else if (status === "valid") {
    where.OR = [{ expiryDate: null }, { expiryDate: { gt: soonCutoff } }];
  }

  const certifications = await prisma.certification.findMany({
    where,
    include: { employee: employeeSelect },
    // Soonest expiry first; certifications that never expire sort last.
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
  });

  res.json({ certifications, expiringSoonDays: EXPIRING_SOON_DAYS });
});

/** Renewal watch list for the HR overview. */
router.get("/expiring", async (req, res) => {
  const days = Number(req.query.days) > 0 ? Number(req.query.days) : EXPIRING_SOON_DAYS;
  const today = todayUtc();
  const cutoff = new Date(today.getTime() + days * 86_400_000);

  const [expiring, expired] = await Promise.all([
    prisma.certification.findMany({
      where: { expiryDate: { gte: today, lte: cutoff } },
      include: { employee: employeeSelect },
      orderBy: { expiryDate: "asc" },
    }),
    prisma.certification.findMany({
      where: { expiryDate: { lt: today } },
      include: { employee: employeeSelect },
      orderBy: { expiryDate: "desc" },
    }),
  ]);

  res.json({ days, expiring, expired });
});

router.post("/", async (req, res) => {
  const body = req.body ?? {};

  if (typeof body.employeeId !== "string" || !body.employeeId) {
    return res.status(400).json({ error: "An employee is required" });
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    return res.status(400).json({ error: "Certification name is required" });
  }

  const issueDate = parseDateOnly(body.issueDate);
  const expiryDate = parseDateOnly(body.expiryDate);
  if (issueDate && expiryDate && expiryDate < issueDate) {
    return res.status(400).json({ error: "Expiry date cannot be before the issue date" });
  }

  try {
    const certification = await prisma.certification.create({
      data: {
        employeeId: body.employeeId,
        name: body.name.trim(),
        category: optionalString(body.category),
        issuingBody: optionalString(body.issuingBody),
        certificateNumber: optionalString(body.certificateNumber),
        issueDate,
        expiryDate,
        notes: optionalString(body.notes),
        documentId: optionalString(body.documentId),
      },
      include: { employee: employeeSelect },
    });
    res.status(201).json({ certification });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) {
      return res.status(400).json({ error: "Unknown employee or document" });
    }
    throw err;
  }
});

router.patch("/:id", async (req, res) => {
  const id = req.params.id as string;
  const body = req.body ?? {};

  const existing = await prisma.certification.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Certification not found" });

  // Unchecked input so documentId can be set as a plain foreign key.
  const data: Prisma.CertificationUncheckedUpdateInput = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();

  for (const field of ["category", "issuingBody", "certificateNumber", "notes", "documentId"] as const) {
    if (body[field] !== undefined) data[field] = optionalString(body[field]);
  }

  const nextIssue = body.issueDate !== undefined ? parseDateOnly(body.issueDate) : existing.issueDate;
  const nextExpiry = body.expiryDate !== undefined ? parseDateOnly(body.expiryDate) : existing.expiryDate;
  if (nextIssue && nextExpiry && nextExpiry < nextIssue) {
    return res.status(400).json({ error: "Expiry date cannot be before the issue date" });
  }
  if (body.issueDate !== undefined) data.issueDate = nextIssue;
  if (body.expiryDate !== undefined) data.expiryDate = nextExpiry;

  const certification = await prisma.certification.update({
    where: { id },
    data,
    include: { employee: employeeSelect },
  });

  res.json({ certification });
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.certification.delete({ where: { id: req.params.id as string } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Certification not found" });
    throw err;
  }
});

/* ================================================================== *
 * Training records
 * ================================================================== */

export const trainingRouter = Router();
trainingRouter.use(requireAuth, requireRole("ADMIN", "MANAGER"));

trainingRouter.get("/", async (req, res) => {
  const { employeeId, search } = req.query;

  const where: Prisma.TrainingRecordWhereInput = {};
  if (typeof employeeId === "string" && employeeId) where.employeeId = employeeId;
  if (typeof search === "string" && search.trim()) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { provider: { contains: search, mode: "insensitive" } },
    ];
  }

  const records = await prisma.trainingRecord.findMany({
    where,
    include: { employee: employeeSelect },
    orderBy: [{ completedDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });

  res.json({ records });
});

trainingRouter.post("/", async (req, res) => {
  const body = req.body ?? {};

  if (typeof body.employeeId !== "string" || !body.employeeId) {
    return res.status(400).json({ error: "An employee is required" });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return res.status(400).json({ error: "Training title is required" });
  }

  try {
    const record = await prisma.trainingRecord.create({
      data: {
        employeeId: body.employeeId,
        title: body.title.trim(),
        provider: optionalString(body.provider),
        completedDate: parseDateOnly(body.completedDate),
        durationHours: optionalDecimal(body.durationHours),
        cost: optionalDecimal(body.cost),
        notes: optionalString(body.notes),
      },
      include: { employee: employeeSelect },
    });
    res.status(201).json({ record });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) {
      return res.status(400).json({ error: "Unknown employee" });
    }
    throw err;
  }
});

trainingRouter.patch("/:id", async (req, res) => {
  const id = req.params.id as string;
  const body = req.body ?? {};

  const data: Prisma.TrainingRecordUpdateInput = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (body.provider !== undefined) data.provider = optionalString(body.provider);
  if (body.notes !== undefined) data.notes = optionalString(body.notes);
  if (body.completedDate !== undefined) data.completedDate = parseDateOnly(body.completedDate);
  if (body.durationHours !== undefined) data.durationHours = optionalDecimal(body.durationHours);
  if (body.cost !== undefined) data.cost = optionalDecimal(body.cost);

  try {
    const record = await prisma.trainingRecord.update({
      where: { id },
      data,
      include: { employee: employeeSelect },
    });
    res.json({ record });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Training record not found" });
    throw err;
  }
});

trainingRouter.delete("/:id", async (req, res) => {
  try {
    await prisma.trainingRecord.delete({ where: { id: req.params.id as string } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Training record not found" });
    throw err;
  }
});

export default router;
