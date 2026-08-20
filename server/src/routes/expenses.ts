import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { FINANCE_ROLES, NON_FIELD_ROLES } from "../lib/roles";

const router = Router();

router.use(requireAuth, requireRole(...NON_FIELD_ROLES));

router.get("/", async (req, res) => {
  const { category, projectId } = req.query;

  const where: Prisma.ExpenseWhereInput = {};
  if (typeof category === "string" && category.trim()) {
    where.category = { equals: category, mode: "insensitive" };
  }
  if (typeof projectId === "string" && projectId) {
    where.projectId = projectId;
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });
  res.json({ expenses });
});

router.post("/", requireRole(...FINANCE_ROLES), async (req, res) => {
  const { category, description, amount, date, projectId, supplierId } = req.body ?? {};

  if (typeof category !== "string" || !category.trim()) {
    return res.status(400).json({ error: "Category is required" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  try {
    const expense = await prisma.expense.create({
      data: {
        category: category.trim(),
        description: typeof description === "string" && description ? description : null,
        amount,
        date: date ? new Date(date) : new Date(),
        projectId: typeof projectId === "string" && projectId ? projectId : null,
        supplierId: typeof supplierId === "string" && supplierId ? supplierId : null,
      },
      include: { supplier: { select: { id: true, name: true } } },
    });
    res.status(201).json({ expense });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Project or supplier not found" });
    throw err;
  }
});

router.patch("/:id", requireRole(...FINANCE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { category, description, amount, date, projectId, supplierId } = req.body ?? {};

  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  const data: Prisma.ExpenseUpdateInput = {};
  if (typeof category === "string" && category.trim()) data.category = category.trim();
  if (description !== undefined) data.description = description || null;
  if (amount !== undefined) data.amount = amount;
  if (date !== undefined) data.date = new Date(date);
  if (projectId !== undefined) data.project = projectId ? { connect: { id: projectId } } : { disconnect: true };
  if (supplierId !== undefined) data.supplier = supplierId ? { connect: { id: supplierId } } : { disconnect: true };

  try {
    const expense = await prisma.expense.update({
      where: { id },
      data,
      include: { supplier: { select: { id: true, name: true } } },
    });
    res.json({ expense });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Expense not found" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Project or supplier not found" });
    throw err;
  }
});

router.delete("/:id", requireRole(...FINANCE_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.expense.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Expense not found" });
    throw err;
  }
});

export default router;
