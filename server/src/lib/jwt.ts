import jwt from "jsonwebtoken";
import type { Role } from "./roles";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AuthTokenPayload {
  sub: string;
  role: Role;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  // 30 days, and every authenticated request re-issues it (see lib/authCookie.ts), so an active
  // session never expires and only a month of real inactivity logs someone out. The old 8h with
  // no renewal meant a re-login roughly once a working day.
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
