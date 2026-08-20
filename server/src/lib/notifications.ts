import { prisma } from "./prisma";
import type { NotificationType } from "../generated/prisma/client";
import type { Role } from "./roles";

interface NotifyOptions {
  message?: string;
  link?: string;
}

export async function notifyUser(userId: string, type: NotificationType, title: string, opts: NotifyOptions = {}) {
  await prisma.notification.create({
    data: { userId, type, title, message: opts.message ?? null, link: opts.link ?? null },
  });
}

/** Resolves the employee's linked user account and notifies them. No-ops silently if the employee has no linked login. */
export async function notifyEmployee(
  employeeId: string,
  type: NotificationType,
  title: string,
  opts: NotifyOptions = {},
) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
  if (!employee?.userId) return;
  await notifyUser(employee.userId, type, title, opts);
}

/** Notifies every user holding one of the given roles - for events with a role-based audience (e.g. "a report needs review") rather than one specific recipient. */
export async function notifyRoles(
  roles: readonly Role[],
  type: NotificationType,
  title: string,
  opts: NotifyOptions = {},
) {
  const users = await prisma.user.findMany({ where: { role: { in: roles as Role[] } }, select: { id: true } });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, type, title, message: opts.message ?? null, link: opts.link ?? null })),
  });
}
