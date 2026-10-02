import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { requireAuth, requireRole } from "./auth";
import { signAuthToken } from "../lib/jwt";

function mockReqRes(cookies: Record<string, string> = {}) {
  const req = { cookies } as unknown as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn();
  return { req, res, next };
}

describe("requireAuth", () => {
  it("rejects when there is no token cookie", () => {
    const { req, res, next } = mockReqRes();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid token", () => {
    const { req, res, next } = mockReqRes({ token: "garbage" });
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches req.user and calls next for a valid token", () => {
    const token = signAuthToken({ sub: "user-1", role: "OPERATIONS_MANAGER" });
    const { req, res, next } = mockReqRes({ token });
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ sub: "user-1", role: "OPERATIONS_MANAGER" });
    expect(res.status).not.toHaveBeenCalled();
    // The 30-day expiry is slid forward on every authenticated request.
    expect(res.cookie).toHaveBeenCalledWith("token", expect.any(String), expect.objectContaining({ maxAge: expect.any(Number) }));
  });
});

describe("requireRole", () => {
  it("rejects when req.user is missing", () => {
    const { req, res, next } = mockReqRes();
    requireRole("ADMIN")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a role that isn't in the allowed list", () => {
    const { req, res, next } = mockReqRes();
    req.user = { sub: "user-1", role: "EMPLOYEE" };
    requireRole("ADMIN", "OPERATIONS_MANAGER")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next for an allowed role", () => {
    const { req, res, next } = mockReqRes();
    req.user = { sub: "user-1", role: "ADMIN" };
    requireRole("ADMIN", "OPERATIONS_MANAGER")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("lets an Operations Manager through anything open to ADMIN (same access, 2026-10-02)", () => {
    const { req, res, next } = mockReqRes();
    req.user = { sub: "user-1", role: "OPERATIONS_MANAGER" };
    requireRole("ADMIN")(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not extend that to roles that aren't admin-equivalent", () => {
    const { req, res, next } = mockReqRes();
    req.user = { sub: "user-1", role: "HR_OFFICER" };
    requireRole("ADMIN")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("still refuses an Operations Manager where ADMIN isn't allowed either", () => {
    const { req, res, next } = mockReqRes();
    req.user = { sub: "user-1", role: "OPERATIONS_MANAGER" };
    requireRole("HR_OFFICER")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
