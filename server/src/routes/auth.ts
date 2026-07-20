import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signAuthToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";

const router = Router();

const COOKIE_NAME = "token";
const isProduction = process.env.NODE_ENV === "production";

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signAuthToken({ sub: user.id, role: user.role });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  res.json({ user });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Current and new password are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ ok: true });
});

export default router;
