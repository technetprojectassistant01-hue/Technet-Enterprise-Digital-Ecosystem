import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma";
import { clearAuthCookieVariants, issueAuthCookie } from "../lib/authCookie";
import { requireAuth } from "../middleware/auth";
import { generateResetToken, hashResetToken } from "../lib/passwordReset";
import { isEmailConfigured, sendPasswordResetEmail } from "../lib/email";
import { logSecurityEvent } from "../lib/securityEvents";
import type { Role } from "../lib/roles";

const router = Router();

/** Kept in sync with LANGUAGES in client/src/i18n/index.tsx. "mfe" is Mauritian Creole. */
export const SUPPORTED_LANGUAGES = ["en", "fr", "mfe"] as const;

/**
 * Only ADMIN accounts can recover a password by email. Everyone else is created by an admin and
 * asks an admin for a reset (User Management -> Reset Password) - staff do not manage their own
 * credentials. Enforced on both the request and the redeem step so a token issued before this
 * rule existed can't still be used by a non-admin.
 */
const SELF_RESET_ROLE: Role = "ADMIN";

/** A handful of attempts per IP is plenty for a real user who mistyped or lost an email. */
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reset requests. Please try again later." },
});


router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: { select: { id: true } } },
  });
  if (!user) {
    await logSecurityEvent("LOGIN_FAILED", { actorEmail: email, detail: "No account with this email" });
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await logSecurityEvent("LOGIN_FAILED", { actorUserId: user.id, actorEmail: email, detail: "Incorrect password" });
    return res.status(401).json({ error: "Invalid email or password" });
  }

  await logSecurityEvent("LOGIN_SUCCEEDED", { actorUserId: user.id, actorEmail: user.email });

  // Wipe any stale token cookie (older SameSite=None; Partitioned variants, or another user's
  // lingering session) before issuing the fresh one, so only this login survives.
  clearAuthCookieVariants(res);
  issueAuthCookie(res, { sub: user.id, role: user.role });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      language: user.language,
      employeeId: user.employee?.id ?? null,
    },
  });
});

router.post("/logout", (_req, res) => {
  clearAuthCookieVariants(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, name: true, role: true, language: true, employee: { select: { id: true } } },
  });

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { employee, ...rest } = user;
  res.json({ user: { ...rest, employeeId: employee?.id ?? null } });
});

/** Saves the signed-in user's UI language so it follows them to any device. */
router.put("/language", requireAuth, async (req, res) => {
  const { language } = req.body ?? {};
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return res.status(400).json({ error: `Language must be one of: ${SUPPORTED_LANGUAGES.join(", ")}` });
  }

  await prisma.user.update({ where: { id: req.user!.sub }, data: { language } });
  res.json({ ok: true, language });
});

router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body ?? {};

  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  // Say so rather than showing "check your inbox" for a mail that cannot be sent. This is a
  // property of the deployment, not of the address, so answering before the lookup leaks nothing
  // about who holds an account.
  if (!isEmailConfigured) {
    return res.status(503).json({
      error:
        "Password reset by email is not available on this system. Ask another administrator to " +
        "reset your password from User Management.",
    });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim() } });

  // Always respond the same way whether the account exists, is an admin, or neither - so the
  // endpoint can't be used to enumerate registered emails or to discover who the admins are.
  // The page itself says plainly that only administrators can reset this way.
  if (user && user.role === SELF_RESET_ROLE) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    const { token, tokenHash, expiresAt } = generateResetToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
    const resetUrl = `${clientOrigin}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);
    await logSecurityEvent("PASSWORD_RESET_REQUESTED", { actorUserId: user.id, actorEmail: user.email });
  }

  res.json({ ok: true });
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body ?? {};

  if (typeof token !== "string" || !token) {
    return res.status(400).json({ error: "Reset token is required" });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const tokenHash = hashResetToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { email: true, role: true } } },
  });

  if (
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt.getTime() < Date.now() ||
    resetToken.user.role !== SELF_RESET_ROLE
  ) {
    return res.status(400).json({ error: "This reset link is invalid or has expired" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId, usedAt: null },
    }),
  ]);
  await logSecurityEvent("PASSWORD_RESET_COMPLETED", {
    actorUserId: resetToken.userId,
    actorEmail: resetToken.user.email,
  });

  res.json({ ok: true });
});

export default router;
