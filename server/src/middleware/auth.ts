import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken, type AuthTokenPayload } from "../lib/jwt";
import { issueAuthCookie } from "../lib/authCookie";

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    req.user = verifyAuthToken(token);
    // Slide the 30-day expiry forward on every authenticated request, so an active session never
    // lapses and only real inactivity signs someone out.
    issueAuthCookie(res, req.user);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function requireRole(...roles: AuthTokenPayload["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
