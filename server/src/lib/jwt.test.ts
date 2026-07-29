import { describe, expect, it } from "vitest";
import { signAuthToken, verifyAuthToken } from "./jwt";

describe("signAuthToken / verifyAuthToken", () => {
  it("round-trips the payload", () => {
    const token = signAuthToken({ sub: "user-1", role: "ADMIN" });
    const payload = verifyAuthToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("ADMIN");
  });

  it("throws on a tampered token", () => {
    const token = signAuthToken({ sub: "user-1", role: "EMPLOYEE" });
    const tampered = token.slice(0, -2) + (token.slice(-2) === "aa" ? "bb" : "aa");
    expect(() => verifyAuthToken(tampered)).toThrow();
  });

  it("throws on garbage input", () => {
    expect(() => verifyAuthToken("not-a-jwt")).toThrow();
  });
});
