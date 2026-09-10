import type { Response } from "express";
import { signPortalToken, type PortalTokenPayload } from "./portalJwt";

const isProduction = process.env.NODE_ENV === "production";

export const PORTAL_COOKIE_NAME = "portal_token";

/**
 * Kept as its own copy of lib/authCookie.ts on purpose — the staff and portal auth domains stay
 * fully independent (see the note in middleware/portalAuth.ts). Same first-party rationale: the
 * client proxies `/api` under its own origin (client/src/worker.ts), so `SameSite=Lax` is enough
 * and — unlike the old `SameSite=None; Secure; Partitioned` — it survives an installed iOS
 * home-screen app being closed.
 */
export const portalCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
};

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Signs a fresh 30-day portal token and (re)sets the cookie; called on login and again on every
 * authenticated request so an active session's expiry slides forward. */
export function issuePortalCookie(res: Response, payload: PortalTokenPayload): void {
  const token = signPortalToken({ portalUserId: payload.portalUserId, customerId: payload.customerId });
  res.cookie(PORTAL_COOKIE_NAME, token, { ...portalCookieOptions, maxAge: MAX_AGE_MS });
}

/** Clears portal_token under every attribute shape it has been set with — see the staff
 * equivalent in lib/authCookie.ts. Call on login (before issuing) and on logout. */
export function clearPortalCookieVariants(res: Response): void {
  res.clearCookie(PORTAL_COOKIE_NAME, portalCookieOptions);
  res.clearCookie(PORTAL_COOKIE_NAME, { httpOnly: true, secure: true, sameSite: "none", partitioned: true });
  res.clearCookie(PORTAL_COOKIE_NAME, { httpOnly: true, secure: true, sameSite: "none" });
}
