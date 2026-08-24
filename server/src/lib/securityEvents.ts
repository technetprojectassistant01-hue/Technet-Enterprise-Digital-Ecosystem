import { prisma } from "./prisma";
import type { SecurityEventType } from "../generated/prisma/client";

interface LogSecurityEventOptions {
  actorUserId?: string | null;
  actorEmail: string;
  targetUserId?: string | null;
  detail?: string;
}

/** Records a security-relevant event (auth, password, user/role management) for the audit log. */
export async function logSecurityEvent(type: SecurityEventType, opts: LogSecurityEventOptions) {
  await prisma.securityEvent.create({
    data: {
      type,
      actorUserId: opts.actorUserId ?? null,
      actorEmail: opts.actorEmail,
      targetUserId: opts.targetUserId ?? null,
      detail: opts.detail ?? null,
    },
  });
}
