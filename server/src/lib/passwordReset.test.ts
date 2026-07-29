import { describe, expect, it } from "vitest";
import { generateResetToken, hashResetToken } from "./passwordReset";

describe("generateResetToken", () => {
  it("produces a token whose hash matches hashResetToken(token)", () => {
    const { token, tokenHash } = generateResetToken();
    expect(hashResetToken(token)).toBe(tokenHash);
  });

  it("produces different tokens on each call", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("sets expiresAt to roughly one hour from now", () => {
    const before = Date.now();
    const { expiresAt } = generateResetToken();
    const after = Date.now();

    const oneHour = 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + oneHour - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + oneHour + 1000);
  });
});

describe("hashResetToken", () => {
  it("is deterministic for the same input", () => {
    expect(hashResetToken("abc")).toBe(hashResetToken("abc"));
  });

  it("differs for different inputs", () => {
    expect(hashResetToken("abc")).not.toBe(hashResetToken("abd"));
  });
});
