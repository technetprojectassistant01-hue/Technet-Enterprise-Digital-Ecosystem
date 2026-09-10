import type { Response } from "express";
import { signAuthToken, type AuthTokenPayload } from "./jwt";

const isProduction = process.env.NODE_ENV === "production";

export const AUTH_COOKIE_NAME = "token";

/**
 * The staff session cookie is first-party now. The client (Cloudflare) proxies `/api` to the
 * Render API under its own origin (client/src/worker.ts), so the browser only ever talks to one
 * site. `SameSite=Lax` is enough for that — and, unlike the old `SameSite=None; Secure;
 * Partitioned`, it survives an installed iOS home-screen app being closed, which is the whole
 * reason for the change. `Secure` only in production so local dev needs no HTTPS.
 */
export const authCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
};

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Signs a fresh 30-day token and (re)sets the cookie. Called on login and again on every
 * authenticated request, so an active session's expiry slides forward.
 */
export function issueAuthCookie(res: Response, payload: AuthTokenPayload): void {
  // Only the identity claims — a verified token also carries iat/exp, which jwt.sign rejects
  // alongside expiresIn.
  const token = signAuthToken({ sub: payload.sub, role: payload.role });
  res.cookie(AUTH_COOKIE_NAME, token, { ...authCookieOptions, maxAge: MAX_AGE_MS });
}

/**
 * Clears the `token` cookie under every attribute shape it has been set with. Browsers treat a
 * cookie set as `SameSite=None; Partitioned` (the pre-2026-09-09 cross-origin form) as a
 * *different* cookie from the current `SameSite=Lax` one, so a stale variant from an earlier
 * session (possibly a different user) can linger and be the one the server reads — which showed
 * up as an admin getting "Insufficient permissions". Call this on login (before issuing the
 * fresh cookie) and on logout so only one `token` can survive.
 */
export function clearAuthCookieVariants(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions);
  res.clearCookie(AUTH_COOKIE_NAME, { httpOnly: true, secure: true, sameSite: "none", partitioned: true });
  res.clearCookie(AUTH_COOKIE_NAME, { httpOnly: true, secure: true, sameSite: "none" });
}
