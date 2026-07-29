import { randomBytes, createHash } from "node:crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface GeneratedResetToken {
  /** Raw value sent to the user via email; never stored. */
  token: string;
  /** SHA-256 digest of `token`; this is what gets stored in the database. */
  tokenHash: string;
  expiresAt: Date;
}

export function generateResetToken(): GeneratedResetToken {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
