import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError, isUniqueConstraintError } from "../lib/prismaErrors";
import { SALES_ROLES, NON_FIELD_ROLES } from "../lib/roles";

/** A random temporary password for portal access, same shape as User Management's Reset Password. */
function generateTempPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

const router = Router();

router.use(requireAuth, requireRole(...NON_FIELD_ROLES));

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

  const customers = await prisma.customer.findMany({
    where,
    include: { portalUser: { select: { id: true, email: true } } },
    orderBy: { name: "asc" },
  });
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
      portalUser: { select: { id: true, email: true, createdAt: true } },
    },
  });

  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  res.json({ customer });
});

router.post("/", requireRole(...SALES_ROLES), async (req, res) => {
  const { name, email, phone, company, address, vatNumber, taxNumber } = req.body ?? {};

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
      vatNumber: typeof vatNumber === "string" && vatNumber ? vatNumber : null,
      taxNumber: typeof taxNumber === "string" && taxNumber ? taxNumber : null,
    },
  });
  res.status(201).json({ customer });
});

router.patch("/:id", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { name, email, phone, company, address, vatNumber, taxNumber } = req.body ?? {};

  const data: Prisma.CustomerUpdateInput = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (email !== undefined) data.email = email || null;
  if (phone !== undefined) data.phone = phone || null;
  if (company !== undefined) data.company = company || null;
  if (address !== undefined) data.address = address || null;
  if (vatNumber !== undefined) data.vatNumber = vatNumber || null;
  if (taxNumber !== undefined) data.taxNumber = taxNumber || null;

  try {
    const customer = await prisma.customer.update({ where: { id }, data });
    res.json({ customer });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Customer not found" });
    throw err;
  }
});

router.delete("/:id", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.customer.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Customer not found" });
    if (isForeignKeyConstraintError(err)) {
      return res
        .status(409)
        .json({ error: "Customer has related invoices, quotations, contracts, or projects and cannot be deleted" });
    }
    throw err;
  }
});

/* ------------------------------------------------------------------ *
 * Portal access (Technet Connect) - grant/reset/revoke a customer login
 * ------------------------------------------------------------------ */

router.post("/:id/portal-access", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { email } = req.body ?? {};

  const customer = await prisma.customer.findUnique({ where: { id }, select: { email: true } });
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  const portalEmail = typeof email === "string" && email.trim() ? email.trim() : customer.email;
  if (!portalEmail) {
    return res.status(400).json({ error: "An email is required (this customer has none on file)" });
  }

  const password = generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.customerPortalUser.create({
      data: { customerId: id, email: portalEmail, passwordHash, createdById: req.user!.sub },
    });
    res.status(201).json({ email: portalEmail, password });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "Portal access already exists for this customer, or that email is already in use" });
    }
    throw err;
  }
});

router.post("/:id/portal-access/reset", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const password = generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const portalUser = await prisma.customerPortalUser.update({
      where: { customerId: id },
      data: { passwordHash },
    });
    res.json({ email: portalUser.email, password });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "This customer has no portal access to reset" });
    throw err;
  }
});

router.delete("/:id/portal-access", requireRole(...SALES_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.customerPortalUser.delete({ where: { customerId: id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "This customer has no portal access to revoke" });
    throw err;
  }
});

export default router;
