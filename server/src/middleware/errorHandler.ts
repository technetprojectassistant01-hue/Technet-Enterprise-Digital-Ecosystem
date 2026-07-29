import type { Request, Response, NextFunction } from "express";
import {
  isForeignKeyConstraintError,
  isNotFoundError,
  isUniqueConstraintError,
} from "../lib/prismaErrors";

/** Mounted after all routers to give unmatched /api/* paths a clean JSON 404. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

/**
 * Last-resort safety net. Express 5 auto-forwards rejected async handlers
 * here, so this also catches Prisma errors in routes that don't wrap their
 * own try/catch (several list/create handlers today don't). Known error
 * shapes get the same clean response a manual try/catch would produce;
 * anything else is logged and returns a generic 500 without leaking
 * internals to the client.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  if (isUniqueConstraintError(err)) {
    return res.status(409).json({ error: "A record with that value already exists" });
  }
  if (isForeignKeyConstraintError(err)) {
    return res.status(409).json({ error: "This action conflicts with related records" });
  }
  if (isNotFoundError(err)) {
    return res.status(404).json({ error: "Not found" });
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
