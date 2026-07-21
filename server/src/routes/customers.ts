import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { search } = req.query;

  const where: Prisma.CustomerWhereInput = {};
  if (typeof search === "string" && search.trim()) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({ where, orderBy: { name: "asc" } });
  res.json({ customers });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      invoices: { orderBy: { issueDate: "desc" }, take: 10 },
      quotations: { orderBy: { issuedAt: "desc" }, take: 10 },
      contracts: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  res.json({ customer });
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { name, email, phone, company, address } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  const customer = await prisma.customer.create({
    data: {
      name: name.trim(),
      email: typeof email === "string" && email ? email : null,
      phone: typeof phone === "string" && phone ? phone : null,
      company: typeof company === "string" && company ? company : null,
      address: typeof address === "string" && address ? address : null,
    },
  });
  res.status(201).json({ customer });
});

router.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { name, email, phone, company, address } = req.body ?? {};

  const data: Prisma.CustomerUpdateInput = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (email !== undefined) data.email = email || null;
  if (phone !== undefined) data.phone = phone || null;
  if (company !== undefined) data.company = company || null;
  if (address !== undefined) data.address = address || null;

  try {
    const customer = await prisma.customer.update({ where: { id }, data });
    res.json({ customer });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ error: "Customer not found" });
    }
    throw err;
  }
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.customer.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return res.status(404).json({ error: "Customer not found" });
      if (err.code === "P2003") {
        return res
          .status(409)
          .json({ error: "Customer has related invoices, quotations, or contracts and cannot be deleted" });
      }
    }
    throw err;
  }
});

export default router;
