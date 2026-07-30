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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
