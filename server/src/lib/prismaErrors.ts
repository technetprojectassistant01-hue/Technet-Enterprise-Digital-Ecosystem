import { Prisma } from "../generated/prisma/client";

// The Prisma 7 Postgres driver adapter surfaces constraint violations in three
// different shapes, and which one you get depends on the operation:
//
//  1. The classic wrapped PrismaClientKnownRequestError (P2002/P2003).
//  2. A raw DriverAdapterError thrown straight from the adapter.
//  3. A PrismaClientKnownRequestError with code P2039 carrying the adapter
//     error nested under `meta.driverAdapterError` — this is what an
//     ON DELETE RESTRICT violation produces.
//
// The adapter's error mapper only special-cases SQLSTATE 23503
// (foreign_key_violation) as "ForeignKeyConstraintViolation". RESTRICT raises
// 23001 (restrict_violation) instead, which falls through to a generic
// { kind: "postgres", code } shape. Check every shape, by kind and by raw
// SQLSTATE, so callers return a clean 409 rather than an unhandled 500.
interface DriverErrorCause {
  kind?: string;
  code?: string;
}

interface DriverAdapterErrorLike {
  name?: string;
  cause?: DriverErrorCause;
}

/** Collects the adapter-level causes reachable from an unknown thrown value. */
function driverErrorCauses(err: unknown): DriverErrorCause[] {
  const causes: DriverErrorCause[] = [];

  const direct = err as DriverAdapterErrorLike;
  if (direct?.name === "DriverAdapterError" && direct.cause) {
    causes.push(direct.cause);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = err.meta as { driverAdapterError?: DriverAdapterErrorLike } | undefined;
    const nested = meta?.driverAdapterError;
    if (nested?.cause) causes.push(nested.cause);
  }

  return causes;
}

export function isUniqueConstraintError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return true;
  return driverErrorCauses(err).some(
    (cause) => cause.kind === "UniqueConstraintViolation" || cause.code === "23505",
  );
}

export function isForeignKeyConstraintError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") return true;
  return driverErrorCauses(err).some(
    (cause) =>
      cause.kind === "ForeignKeyConstraintViolation" ||
      cause.code === "23503" ||
      cause.code === "23001",
  );
}

export function isNotFoundError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}
