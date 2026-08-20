import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isUniqueConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { HR_ROLES } from "../lib/roles";

const router = Router();

// Same access shape as the rest of the leave module - holidays only matter for HR's own
// leave/payroll calculations, so this isn't a general-purpose company calendar.
router.use(requireAuth, requireRole(...HR_ROLES));

/** Parses a YYYY-MM-DD string into a UTC midnight Date, matching the leave module's convention. */
function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

router.get("/", async (req, res) => {
  const year = req.query.year;
  const where =
    typeof year === "string" && /^\d{4}$/.test(year)
      ? { date: { gte: new Date(`${year}-01-01T00:00:00.000Z`), lt: new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`) } }
      : {};

  const holidays = await prisma.publicHoliday.findMany({ where, orderBy: { date: "asc" } });
  res.json({ holidays });
});

router.post("/", async (req, res) => {
  const { name } = req.body ?? {};
  const date = parseDateOnly(req.body?.date);

  if (!date) return res.status(400).json({ error: "A valid date is required" });
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Name is required" });

  try {
    const holiday = await prisma.publicHoliday.create({ data: { date, name: name.trim() } });
    res.status(201).json({ holiday });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "A holiday is already recorded on that date" });
    throw err;
  }
});

router.delete("/:id", async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.publicHoliday.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Holiday not found" });
    throw err;
  }
});

export default router;
