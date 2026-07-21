import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isUniqueConstraintError, isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { search } = req.query;

  const where: Prisma.EmployeeWhereInput = {};
  if (typeof search === "string" && search.trim()) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { employeeCode: { contains: search, mode: "insensitive" } },
    ];
  }

  const employees = await prisma.employee.findMany({ where, orderBy: { firstName: "asc" } });
  res.json({ employees });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { managedProjects: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  if (!employee) {
    return res.status(404).json({ error: "Employee not found" });
  }

  res.json({ employee });
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const { employeeCode, firstName, lastName, email, phone, position, department, employmentStatus, hireDate } =
    req.body ?? {};

  if (typeof employeeCode !== "string" || !employeeCode.trim()) {
    return res.status(400).json({ error: "Employee code is required" });
  }
  if (typeof firstName !== "string" || !firstName.trim() || typeof lastName !== "string" || !lastName.trim()) {
    return res.status(400).json({ error: "First and last name are required" });
  }

  try {
    const employee = await prisma.employee.create({
      data: {
        employeeCode: employeeCode.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: typeof email === "string" && email ? email : null,
        phone: typeof phone === "string" && phone ? phone : null,
        position: typeof position === "string" && position ? position : null,
        department: typeof department === "string" && department ? department : null,
        employmentStatus: employmentStatus || "ACTIVE",
        hireDate: hireDate ? new Date(hireDate) : null,
      },
    });
    res.status(201).json({ employee });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "An employee with that code already exists" });
    }
    throw err;
  }
});

router.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  const { employeeCode, firstName, lastName, email, phone, position, department, employmentStatus, hireDate } =
    req.body ?? {};

  const data: Prisma.EmployeeUpdateInput = {};
  if (typeof employeeCode === "string" && employeeCode.trim()) data.employeeCode = employeeCode.trim();
  if (typeof firstName === "string" && firstName.trim()) data.firstName = firstName.trim();
  if (typeof lastName === "string" && lastName.trim()) data.lastName = lastName.trim();
  if (email !== undefined) data.email = email || null;
  if (phone !== undefined) data.phone = phone || null;
  if (position !== undefined) data.position = position || null;
  if (department !== undefined) data.department = department || null;
  if (employmentStatus !== undefined) data.employmentStatus = employmentStatus;
  if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null;

  try {
    const employee = await prisma.employee.update({ where: { id }, data });
    res.json({ employee });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Employee not found" });
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "An employee with that code already exists" });
    }
    throw err;
  }
});

router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.employee.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Employee not found" });
    if (isForeignKeyConstraintError(err)) {
      return res
        .status(409)
        .json({ error: "Employee is a project manager or assigned to a project and cannot be deleted" });
    }
    throw err;
  }
});

export default router;
