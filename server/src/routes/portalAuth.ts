import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signPortalToken } from "../lib/portalJwt";
import { requirePortalAuth, PORTAL_COOKIE_NAME } from "../middleware/portalAuth";

const router = Router();

const isProduction = process.env.NODE_ENV === "production";

// Same cross-origin reasoning as server/src/routes/auth.ts's cookieOptions - client and server
// are different sites in production, so SameSite=None (+ Secure, + Partitioned for CHIPS) is
// required for the cookie to actually be sent. Kept as its own copy rather than importing from
// auth.ts so the two auth domains stay fully independent, not accidentally coupled later.
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
  partitioned: isProduction,
};

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const portalUser = await prisma.customerPortalUser.findUnique({
    where: { email },
    include: { customer: { select: { id: true, name: true, company: true } } },
  });
  if (!portalUser) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await bcrypt.compare(password, portalUser.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signPortalToken({ portalUserId: portalUser.id, customerId: portalUser.customerId });

  res.cookie(PORTAL_COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({
    customer: { id: portalUser.customer.id, name: portalUser.customer.company || portalUser.customer.name, email: portalUser.email },
  });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(PORTAL_COOKIE_NAME, cookieOptions);
  res.json({ ok: true });
});

router.get("/me", requirePortalAuth, async (req, res) => {
  const portalUser = await prisma.customerPortalUser.findUnique({
    where: { id: req.portalUser!.portalUserId },
    include: { customer: { select: { id: true, name: true, company: true } } },
  });

  if (!portalUser) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  res.json({
    customer: { id: portalUser.customer.id, name: portalUser.customer.company || portalUser.customer.name, email: portalUser.email },
  });
});

export default router;
