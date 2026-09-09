import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const JWT_SECRET: string = process.env.JWT_SECRET;

/** The "portal" audience claim is the actual enforcement boundary: a customer portal token can
 * never verify against staff's verifyAuthToken (no audience check there, but a different secret
 * usage would be needed) and, more importantly, a staff token can never verify here - even if a
 * future bug ever mixed up which cookie got read, jwt.verify rejects a mismatched audience. */
const PORTAL_AUDIENCE = "portal";

export interface PortalTokenPayload {
  portalUserId: string;
  customerId: string;
}

export function signPortalToken(payload: PortalTokenPayload): string {
  // 30 days, re-issued on every authenticated request (see lib/portalAuthCookie.ts) — same
  // "log in once" behaviour the staff app now has.
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d", audience: PORTAL_AUDIENCE });
}

export function verifyPortalToken(token: string): PortalTokenPayload {
  return jwt.verify(token, JWT_SECRET, { audience: PORTAL_AUDIENCE }) as PortalTokenPayload;
}
