import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const userId = req.user!.sub;
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  res.json({ notifications, unreadCount });
});

router.post("/:id/read", async (req, res) => {
  const id = req.params.id as string;
  await prisma.notification.updateMany({
    where: { id, userId: req.user!.sub },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

router.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.sub, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

export default router;
