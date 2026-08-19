import { prisma } from "./prisma";
import type { NotificationType } from "../generated/prisma/client";

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
