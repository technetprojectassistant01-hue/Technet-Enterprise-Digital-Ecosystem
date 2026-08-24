import type { Request, Response, NextFunction } from "express";
import { verifyPortalToken, type PortalTokenPayload } from "../lib/portalJwt";

declare global {
  namespace Express {
    interface Request {
      /** Set only by requirePortalAuth, on a distinct property from `user` (staff) - a portal
       * token and a staff token can never be confused with each other structurally. */
      portalUser?: PortalTokenPayload;
    }
  }
}

export const PORTAL_COOKIE_NAME = "portal_token";

export function requirePortalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[PORTAL_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    req.portalUser = verifyPortalToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}
