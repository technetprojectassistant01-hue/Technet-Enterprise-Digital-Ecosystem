import { Router } from "express";
import { Prisma, type SecurityEventType } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

const SECURITY_EVENT_TYPES = [
  "LOGIN_SUCCEEDED",
  "LOGIN_FAILED",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_COMPLETED",
  "ADMIN_PASSWORD_RESET_FORCED",
  "USER_CREATED",
  "USER_ROLE_CHANGED",
  "USER_DELETED",
] as const satisfies readonly SecurityEventType[];

const MY_LOGIN_EVENT_TYPES: SecurityEventType[] = ["LOGIN_SUCCEEDED", "LOGIN_FAILED"];

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const eventInclude = {
  actor: { select: { id: true, email: true, name: true } },
  target: { select: { id: true, email: true, name: true } },
} satisfies Prisma.SecurityEventInclude;

/** Company-wide audit log - admin-only. */
router.get("/audit-log", requireRole("ADMIN"), async (req, res) => {
  const { type, actorUserId } = req.query;

  const where: Prisma.SecurityEventWhereInput = {};
  if (typeof type === "string" && (SECURITY_EVENT_TYPES as readonly string[]).includes(type)) {
    where.type = type as SecurityEventType;
  }
  if (typeof actorUserId === "string" && actorUserId) {
    where.actorUserId = actorUserId;
  }

  const from = parseDateOnly(req.query.from);
  const to = parseDateOnly(req.query.to);
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  const take = Math.min(Number(req.query.take) || 50, 200);
  const skip = Number(req.query.skip) || 0;

  const [events, total] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      include: eventInclude,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.securityEvent.count({ where }),
  ]);

  res.json({ events, total });
});

/** The current user's own recent login attempts - not admin-gated, just their own history. */
router.get("/audit-log/me", async (req, res) => {
  const events = await prisma.securityEvent.findMany({
    where: { actorUserId: req.user!.sub, type: { in: MY_LOGIN_EVENT_TYPES } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json({ events });
});

export default router;
