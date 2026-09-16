import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isUniqueConstraintError, isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { ALL_ROLES, type Role } from "../lib/roles";
import { logSecurityEvent } from "../lib/securityEvents";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

/** The acting admin's own email, for actorEmail on security events - the JWT payload only carries sub/role. */
async function actorEmail(req: Request): Promise<string> {
  const actor = await prisma.user.findUnique({ where: { id: req.user!.sub }, select: { email: true } });
  return actor?.email ?? "unknown";
}

/**
 * Logins are admin-managed (CLAUDE.md §20), so the admin owns the email too — including their
 * own, which is the address a password reset would be sent to. Stored lowercase and trimmed, the
 * same normalisation the customer portal needed after real sign-in failures from stray casing.
 */
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Deliberately permissive: something@something.tld, no attempt to out-clever real addresses. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Every relation that points at a User with onDelete: Restrict — i.e. the ones that actually stop
 * a delete. Named in the words an admin would use, because the old error just listed three guesses
 * ("stock movements, documents, or activity") and left them hunting. Keep in step with the schema:
 * a new required User relation belongs here too, or its rows become an unexplained refusal.
 */
async function blockingRecords(userId: string): Promise<string[]> {
  const checks: [string, Promise<number>][] = [
    ["daily report", prisma.dailyWorkReport.count({ where: { submittedById: userId } })],
    ["intervention report", prisma.interventionReport.count({ where: { createdById: userId } })],
    ["maintenance report", prisma.maintenanceReport.count({ where: { submittedById: userId } })],
    ["maintenance request", prisma.maintenanceRequest.count({ where: { requestedById: userId } })],
    ["maintenance contract", prisma.maintenanceContract.count({ where: { createdById: userId } })],
    ["maintenance schedule", prisma.maintenanceSchedule.count({ where: { createdById: userId } })],
    ["work order", prisma.workOrder.count({ where: { createdById: userId } })],
    ["document", prisma.document.count({ where: { uploadedById: userId } })],
    ["stock movement", prisma.stockMovement.count({ where: { createdById: userId } })],
    ["goods receipt", prisma.goodsReceipt.count({ where: { receivedById: userId } })],
    ["purchase requisition", prisma.purchaseRequisition.count({ where: { requestedById: userId } })],
    ["requisition status change", prisma.requisitionStatusHistory.count({ where: { changedById: userId } })],
    ["project status change", prisma.projectStatusHistory.count({ where: { changedById: userId } })],
    ["quotation follow-up", prisma.quotationFollowUp.count({ where: { createdById: userId } })],
    ["payroll run", prisma.payrollRun.count({ where: { createdById: userId } })],
    ["tool hand-out", prisma.toolCheckout.count({ where: { issuedById: userId } })],
    ["portal login granted", prisma.customerPortalUser.count({ where: { createdById: userId } })],
  ];
  const counts = await Promise.all(checks.map(([, p]) => p));
  return checks
    .map(([label], i) => [label, counts[i]] as const)
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `${n} ${label}${n === 1 ? "" : "s"}`);
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  // Surfaced so User Management shows at a glance whether a login is attached to an employee
  // record. Without that link the person has no check-in card, no leave and no payroll, which
  // reads as a broken app rather than a missing setup step.
  employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
} satisfies Prisma.UserSelect;

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: "asc" },
  });
  res.json({ users });
});

router.post("/", async (req, res) => {
  const { email, password, name, role } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (!looksLikeEmail(normalizeEmail(email))) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  if (role !== undefined && !ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        email: normalizeEmail(email),
        passwordHash,
        name: typeof name === "string" ? name : null,
        role: (role as Role) || "EMPLOYEE",
      },
      select: userSelect,
    });
    await logSecurityEvent("USER_CREATED", {
      actorUserId: req.user!.sub,
      actorEmail: await actorEmail(req),
      targetUserId: user.id,
      detail: `${user.email} (${user.role})`,
    });
    res.status(201).json({ user });
  } catch (err) {
    if (isUniqueConstraintError(err)) return res.status(409).json({ error: "A user with that email already exists" });
    throw err;
  }
});

router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, role, password, email } = req.body ?? {};

  if (role !== undefined && !ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  if (email !== undefined && (typeof email !== "string" || !looksLikeEmail(normalizeEmail(email)))) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  if (id === req.user!.sub && role !== undefined && role !== "ADMIN") {
    return res.status(400).json({ error: "You cannot change your own role" });
  }
  if (password !== undefined && (typeof password !== "string" || password.length < 8)) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const nextEmail = email !== undefined ? normalizeEmail(email) : undefined;

  const data: Prisma.UserUpdateInput = {};
  if (typeof name === "string") data.name = name;
  if (role !== undefined) data.role = role as Role;
  if (nextEmail !== undefined) data.email = nextEmail;
  if (password !== undefined) data.passwordHash = await bcrypt.hash(password, 12);

  try {
    const before =
      role !== undefined || nextEmail !== undefined
        ? await prisma.user.findUnique({ where: { id }, select: { role: true, email: true } })
        : null;

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    if (role !== undefined && before && before.role !== role) {
      await logSecurityEvent("USER_ROLE_CHANGED", {
        actorUserId: req.user!.sub,
        actorEmail: await actorEmail(req),
        targetUserId: user.id,
        detail: `${before.role} -> ${role}`,
      });
    }
    if (nextEmail !== undefined && before && before.email !== nextEmail) {
      await logSecurityEvent("USER_EMAIL_CHANGED", {
        actorUserId: req.user!.sub,
        actorEmail: await actorEmail(req),
        targetUserId: user.id,
        detail: `${before.email} -> ${nextEmail}`,
      });
    }
    if (password !== undefined && id !== req.user!.sub) {
      await logSecurityEvent("ADMIN_PASSWORD_RESET_FORCED", {
        actorUserId: req.user!.sub,
        actorEmail: await actorEmail(req),
        targetUserId: user.id,
        detail: user.email,
      });
    }

    res.json({ user });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "A user with that email already exists" });
    }
    if (isNotFoundError(err)) return res.status(404).json({ error: "User not found" });
    throw err;
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (id === req.user!.sub) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (!target) return res.status(404).json({ error: "User not found" });

    await prisma.user.delete({ where: { id } });
    await logSecurityEvent("USER_DELETED", {
      actorUserId: req.user!.sub,
      actorEmail: await actorEmail(req),
      detail: target.email,
    });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "User not found" });
    if (isForeignKeyConstraintError(err)) {
      const blockers = await blockingRecords(id);
      const what = blockers.length ? blockers.join(", ") : "records elsewhere in the system";
      return res.status(409).json({
        error: `This account cannot be deleted because its work is still on file: ${what}. Deleting it would erase that history. To hand the login to someone else, use Change Email and set a new name and password instead.`,
      });
    }
    throw err;
  }
});

export default router;
