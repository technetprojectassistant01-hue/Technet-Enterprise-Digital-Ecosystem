import { Prisma } from "../generated/prisma/client";

// The Prisma 7 Postgres driver adapter can throw a raw DriverAdapterError for
// constraint violations instead of the wrapped PrismaClientKnownRequestError
// (P2002/P2003) older engines produced. Its error mapper only special-cases
// SQLSTATE 23503 (foreign_key_violation) as "ForeignKeyConstraintViolation" —
// ON DELETE RESTRICT specifically raises 23001 (restrict_violation), which
// falls through to a generic { kind: "postgres", code } shape instead. Check
// both PrismaClientKnownRequestError and the raw driver error (by kind or by
// raw SQLSTATE) so error handling works regardless of which path Prisma took.
interface DriverAdapterErrorLike {
  name?: string;
  cause?: { kind?: string; code?: string };
}

export function isUniqueConstraintError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return true;
  const e = err as DriverAdapterErrorLike;
  if (e?.name !== "DriverAdapterError") return false;
  return e.cause?.kind === "UniqueConstraintViolation" || e.cause?.code === "23505";
}

export function isForeignKeyConstraintError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") return true;
  const e = err as DriverAdapterErrorLike;
  if (e?.name !== "DriverAdapterError") return false;
  return (
    e.cause?.kind === "ForeignKeyConstraintViolation" ||
    e.cause?.code === "23503" ||
    e.cause?.code === "23001"
  );
}

export function isNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}
