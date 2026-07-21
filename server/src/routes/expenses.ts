import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { category } = req.query;

  const where: Prisma.ExpenseWhereInput = {};
  if (typeof category === "string" && category.trim()) {
    where.category = { equals: category, mode: "insensitive" };
  }

  const expenses = await prisma.expense.findMany({ where, orderBy: { date: "desc" } });
  res.json({ expenses });
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { category, description, amount, date } = req.body ?? {};

  if (typeof category !== "string" || !category.trim()) {
    return res.status(400).json({ error: "Category is required" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  const expense = await prisma.expense.create({
    data: {
      category: category.trim(),
      description: typeof description === "string" && description ? description : null,
      amount,
      date: date ? new Date(date) : new Date(),
    },
  });
  res.status(201).json({ expense });
});

router.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { category, description, amount, date } = req.body ?? {};

  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    return res.status(400).json({ error: "Amount must be a positive number" });
  }

  const data: Prisma.ExpenseUpdateInput = {};
  if (typeof category === "string" && category.trim()) data.category = category.trim();
  if (description !== undefined) data.description = description || null;
  if (amount !== undefined) data.amount = amount;
  if (date !== undefined) data.date = new Date(date);

  try {
    const expense = await prisma.expense.update({ where: { id }, data });
    res.json({ expense });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ error: "Expense not found" });
    }
    throw err;
  }
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.expense.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ error: "Expense not found" });
    }
    throw err;
  }
});

export default router;
