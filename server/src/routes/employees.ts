import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { HR_ROLES } from "../lib/roles";
import { isUniqueConstraintError, isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";

const router = Router();

router.use(requireAuth);

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
const CONTRACT_TYPES = ["PERMANENT", "FIXED_TERM", "CASUAL", "INTERN", "CONSULTANT"] as const;
const EMPLOYMENT_STATUSES = ["ACTIVE", "ON_LEAVE", "TERMINATED"] as const;

/** Trimmed string, or null when the caller sent an empty value. */
function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function optionalDecimal(value: unknown): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return new Prisma.Decimal(num.toFixed(2));
}

function optionalEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : null;
}

/**
 * Every authenticated role can list employees, because the technician pickers in
 * Projects and Operations depend on it. Personal and payroll data is HR-only, so
 * it is stripped for anyone who is not an admin or manager.
 */
export const SENSITIVE_FIELDS = [
  "nationalId",
  "dateOfBirth",
  "gender",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelation",
  "basicSalary",
  "bankName",
  "bankAccountNumber",
  "exitReason",
  "notes",
] as const;

function canSeeSensitiveData(req: { user?: { role: string } }): boolean {
  return req.user?.role === "ADMIN" || req.user?.role === "HR_OFFICER";
}

export function redact<T extends Record<string, unknown>>(employee: T): T {
  const copy = { ...employee };
  for (const field of SENSITIVE_FIELDS) {
    if (field in copy) copy[field as keyof T] = null as T[keyof T];
  }
  return copy;
}

router.get("/", async (req, res) => {
  const { search, department, status } = req.query;

  const where: Prisma.EmployeeWhereInput = {};

  if (typeof search === "string" && search.trim()) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { employeeCode: { contains: search, mode: "insensitive" } },
      { position: { contains: search, mode: "insensitive" } },
    ];
  }

  if (typeof department === "string" && department.trim()) {
    where.department = department;
  }

  const employmentStatus = optionalEnum(status, EMPLOYMENT_STATUSES);
  if (employmentStatus) {
    where.employmentStatus = employmentStatus;
  }

  const employees = await prisma.employee.findMany({ where, orderBy: { firstName: "asc" } });
  res.json({ employees: canSeeSensitiveData(req) ? employees : employees.map(redact) });
});

/** Distinct departments, so the UI can offer a filter without a separate table. */
router.get("/departments", async (_req, res) => {
  const rows = await prisma.employee.findMany({
    where: { department: { not: null } },
    distinct: ["department"],
    select: { department: true },
    orderBy: { department: "asc" },
  });
  res.json({ departments: rows.map((r) => r.department).filter((d): d is string => Boolean(d)) });
});

router.get("/:id", async (req, res) => {
  const id = req.params.id as string;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, role: true } },
      managedProjects: { orderBy: { createdAt: "desc" }, take: 10 },
      projectAssignments: {
        orderBy: { assignedAt: "desc" },
        take: 10,
        include: { project: { select: { id: true, projectNumber: true, name: true, status: true } } },
      },
    },
  });

  if (!employee) {
    return res.status(404).json({ error: "Employee not found" });
  }

  res.json({ employee: canSeeSensitiveData(req) ? employee : redact(employee) });
});

router.post("/", requireRole(...HR_ROLES), async (req, res) => {
  const body = req.body ?? {};
  const { employeeCode, firstName, lastName } = body;

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
        email: optionalString(body.email),
        phone: optionalString(body.phone),
        position: optionalString(body.position),
        department: optionalString(body.department),
        employmentStatus: optionalEnum(body.employmentStatus, EMPLOYMENT_STATUSES) ?? "ACTIVE",
        hireDate: optionalDate(body.hireDate),

        nationalId: optionalString(body.nationalId),
        dateOfBirth: optionalDate(body.dateOfBirth),
        gender: optionalEnum(body.gender, GENDERS),
        address: optionalString(body.address),

        emergencyContactName: optionalString(body.emergencyContactName),
        emergencyContactPhone: optionalString(body.emergencyContactPhone),
        emergencyContactRelation: optionalString(body.emergencyContactRelation),

        contractType: optionalEnum(body.contractType, CONTRACT_TYPES),
        jobGrade: optionalString(body.jobGrade),
        probationEndDate: optionalDate(body.probationEndDate),
        contractEndDate: optionalDate(body.contractEndDate),
        exitDate: optionalDate(body.exitDate),
        exitReason: optionalString(body.exitReason),

        basicSalary: optionalDecimal(body.basicSalary),
        bankName: optionalString(body.bankName),
        bankAccountNumber: optionalString(body.bankAccountNumber),

        notes: optionalString(body.notes),
      },
    });
    res.status(201).json({ employee });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "An employee with that code or national ID already exists" });
    }
    throw err;
  }
});

router.patch("/:id", requireRole(...HR_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const body = req.body ?? {};

  const data: Prisma.EmployeeUpdateInput = {};

  // Required fields are only updated when a non-empty value is supplied.
  if (typeof body.employeeCode === "string" && body.employeeCode.trim()) data.employeeCode = body.employeeCode.trim();
  if (typeof body.firstName === "string" && body.firstName.trim()) data.firstName = body.firstName.trim();
  if (typeof body.lastName === "string" && body.lastName.trim()) data.lastName = body.lastName.trim();

  // Optional fields are cleared when the caller explicitly sends an empty value.
  const stringFields = [
    "email",
    "phone",
    "position",
    "department",
    "nationalId",
    "address",
    "emergencyContactName",
    "emergencyContactPhone",
    "emergencyContactRelation",
    "jobGrade",
    "exitReason",
    "bankName",
    "bankAccountNumber",
    "notes",
  ] as const;
  for (const field of stringFields) {
    if (body[field] !== undefined) data[field] = optionalString(body[field]);
  }

  const dateFields = ["hireDate", "dateOfBirth", "probationEndDate", "contractEndDate", "exitDate"] as const;
  for (const field of dateFields) {
    if (body[field] !== undefined) data[field] = optionalDate(body[field]);
  }

  if (body.employmentStatus !== undefined) {
    const status = optionalEnum(body.employmentStatus, EMPLOYMENT_STATUSES);
    if (!status) return res.status(400).json({ error: "Invalid employment status" });
    data.employmentStatus = status;
  }
  if (body.gender !== undefined) data.gender = optionalEnum(body.gender, GENDERS);
  if (body.contractType !== undefined) data.contractType = optionalEnum(body.contractType, CONTRACT_TYPES);
  if (body.basicSalary !== undefined) data.basicSalary = optionalDecimal(body.basicSalary);

  try {
    const employee = await prisma.employee.update({ where: { id }, data });
    res.json({ employee });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Employee not found" });
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "An employee with that code or national ID already exists" });
    }
    throw err;
  }
});

router.delete("/:id", requireRole(...HR_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.employee.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Employee not found" });
    if (isForeignKeyConstraintError(err)) {
      return res
        .status(409)
        .json({ error: "Employee has linked records (projects, leave, attendance) and cannot be deleted" });
    }
    throw err;
  }
});

export default router;
