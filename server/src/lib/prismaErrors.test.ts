import { describe, expect, it } from "vitest";
import { Prisma } from "../generated/prisma/client";
import {
  isForeignKeyConstraintError,
  isNotFoundError,
  isUniqueConstraintError,
} from "./prismaErrors";

function knownRequestError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("mock error", {
    code,
    clientVersion: "test",
    meta,
  });
}

function driverAdapterError(kind: string, code: string) {
  return { name: "DriverAdapterError", cause: { kind, code } };
}

describe("isUniqueConstraintError", () => {
  it("matches a wrapped P2002", () => {
    expect(isUniqueConstraintError(knownRequestError("P2002"))).toBe(true);
  });

  it("matches a raw DriverAdapterError with UniqueConstraintViolation", () => {
    expect(isUniqueConstraintError(driverAdapterError("UniqueConstraintViolation", "23505"))).toBe(
      true,
    );
  });

  it("matches a nested meta.driverAdapterError", () => {
    const err = knownRequestError("P2039", {
      driverAdapterError: driverAdapterError("UniqueConstraintViolation", "23505"),
    });
    expect(isUniqueConstraintError(err)).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isUniqueConstraintError(new Error("nope"))).toBe(false);
    expect(isUniqueConstraintError(knownRequestError("P2003"))).toBe(false);
  });
});

describe("isForeignKeyConstraintError", () => {
  it("matches a wrapped P2003", () => {
    expect(isForeignKeyConstraintError(knownRequestError("P2003"))).toBe(true);
  });

  it("matches CASCADE-style 23503 violations", () => {
    expect(
      isForeignKeyConstraintError(driverAdapterError("ForeignKeyConstraintViolation", "23503")),
    ).toBe(true);
  });

  it("matches RESTRICT-style 23001 violations nested under meta", () => {
    const err = knownRequestError("P2039", {
      driverAdapterError: { name: "DriverAdapterError", cause: { kind: "postgres", code: "23001" } },
    });
    expect(isForeignKeyConstraintError(err)).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isForeignKeyConstraintError(new Error("nope"))).toBe(false);
    expect(isForeignKeyConstraintError(knownRequestError("P2002"))).toBe(false);
  });
});

describe("isNotFoundError", () => {
  it("matches a wrapped P2025", () => {
    expect(isNotFoundError(knownRequestError("P2025"))).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isNotFoundError(new Error("nope"))).toBe(false);
    expect(isNotFoundError(knownRequestError("P2002"))).toBe(false);
  });
});
