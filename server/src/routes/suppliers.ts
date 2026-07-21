import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { search } = req.query;

  const where: Prisma.SupplierWhereInput = {};
  if (typeof search === "string" && search.trim()) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const suppliers = await prisma.supplier.findMany({ where, orderBy: { name: "asc" } });
  res.json({ suppliers });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      purchaseOrders: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!supplier) {
    return res.status(404).json({ error: "Supplier not found" });
  }

  res.json({ supplier });
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { name, contactName, email, phone, address, paymentTerms } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  const supplier = await prisma.supplier.create({
    data: {
      name: name.trim(),
      contactName: typeof contactName === "string" && contactName ? contactName : null,
      email: typeof email === "string" && email ? email : null,
      phone: typeof phone === "string" && phone ? phone : null,
      address: typeof address === "string" && address ? address : null,
      paymentTerms: typeof paymentTerms === "string" && paymentTerms ? paymentTerms : null,
    },
  });
  res.status(201).json({ supplier });
});

router.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { name, contactName, email, phone, address, paymentTerms } = req.body ?? {};

  const data: Prisma.SupplierUpdateInput = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (contactName !== undefined) data.contactName = contactName || null;
  if (email !== undefined) data.email = email || null;
  if (phone !== undefined) data.phone = phone || null;
  if (address !== undefined) data.address = address || null;
  if (paymentTerms !== undefined) data.paymentTerms = paymentTerms || null;

  try {
    const supplier = await prisma.supplier.update({ where: { id }, data });
    res.json({ supplier });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Supplier not found" });
    throw err;
  }
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.supplier.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Supplier not found" });
    if (isForeignKeyConstraintError(err)) {
      return res
        .status(409)
        .json({ error: "Supplier has related inventory items, purchase orders, or expenses and cannot be deleted" });
    }
    throw err;
  }
});

export default router;
