import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isNotFoundError } from "../lib/prismaErrors";
import { MARKETING_ROLES, NON_FIELD_ROLES } from "../lib/roles";

const router = Router();

export const MARKETING_PLATFORMS = ["LinkedIn", "Facebook", "Instagram", "Other"] as const;

const POST_STATUSES = ["PLANNED", "POSTED", "CANCELLED"] as const;
type PostStatus = (typeof POST_STATUSES)[number];

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[0]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const CAMPAIGN_SELECT = { id: true, name: true };
const CREATED_BY_SELECT = { id: true, name: true, email: true };

router.use(requireAuth, requireRole(...NON_FIELD_ROLES));

// ---- Campaigns ----

router.get("/campaigns", async (req, res) => {
  const { search } = req.query;
  const where: Prisma.MarketingCampaignWhereInput = {};
  if (typeof search === "string" && search.trim()) {
    where.name = { contains: search, mode: "insensitive" };
  }

  const campaigns = await prisma.marketingCampaign.findMany({
    where,
    include: { createdBy: { select: CREATED_BY_SELECT }, _count: { select: { posts: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ campaigns });
});

router.get("/campaigns/:id", async (req, res) => {
  const id = req.params.id as string;
  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id },
    include: {
      createdBy: { select: CREATED_BY_SELECT },
      posts: { orderBy: { scheduledDate: "asc" } },
    },
  });
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  res.json({ campaign });
});

router.post("/campaigns", requireRole(...MARKETING_ROLES), async (req, res) => {
  const { name, description, startDate, endDate } = req.body;
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Campaign name is required" });
  }

  const campaign = await prisma.marketingCampaign.create({
    data: {
      name: name.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      startDate: parseDateOnly(startDate),
      endDate: parseDateOnly(endDate),
      createdById: req.user!.sub,
    },
    include: { createdBy: { select: CREATED_BY_SELECT } },
  });
  res.status(201).json({ campaign });
});

router.patch("/campaigns/:id", requireRole(...MARKETING_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { name, description, startDate, endDate } = req.body;

  const data: Prisma.MarketingCampaignUpdateInput = {};
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Campaign name is required" });
    }
    data.name = name.trim();
  }
  if (description !== undefined) {
    data.description = typeof description === "string" && description.trim() ? description.trim() : null;
  }
  if (startDate !== undefined) data.startDate = parseDateOnly(startDate);
  if (endDate !== undefined) data.endDate = parseDateOnly(endDate);

  try {
    const campaign = await prisma.marketingCampaign.update({
      where: { id },
      data,
      include: { createdBy: { select: CREATED_BY_SELECT } },
    });
    res.json({ campaign });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Campaign not found" });
    throw err;
  }
});

router.delete("/campaigns/:id", requireRole(...MARKETING_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.marketingCampaign.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Campaign not found" });
    throw err;
  }
});

// ---- Posts ----

router.post("/campaigns/:campaignId/posts", requireRole(...MARKETING_ROLES), async (req, res) => {
  const campaignId = req.params.campaignId as string;
  const { title, platform, copy, scheduledDate } = req.body;

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Post title is required" });
  }
  if (!MARKETING_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: "Invalid platform" });
  }
  const scheduled = parseDateOnly(scheduledDate);
  if (!scheduled) {
    return res.status(400).json({ error: "A scheduled date is required" });
  }

  try {
    const post = await prisma.marketingPost.create({
      data: {
        campaignId,
        title: title.trim(),
        platform,
        copy: typeof copy === "string" && copy.trim() ? copy.trim() : null,
        scheduledDate: scheduled,
        createdById: req.user!.sub,
      },
    });
    res.status(201).json({ post });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Campaign not found" });
    throw err;
  }
});

router.patch("/posts/:id", requireRole(...MARKETING_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { title, platform, copy, scheduledDate, status } = req.body;

  const data: Prisma.MarketingPostUpdateInput = {};
  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Post title is required" });
    }
    data.title = title.trim();
  }
  if (platform !== undefined) {
    if (!MARKETING_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: "Invalid platform" });
    }
    data.platform = platform;
  }
  if (copy !== undefined) {
    data.copy = typeof copy === "string" && copy.trim() ? copy.trim() : null;
  }
  if (scheduledDate !== undefined) {
    const scheduled = parseDateOnly(scheduledDate);
    if (!scheduled) return res.status(400).json({ error: "Invalid scheduled date" });
    data.scheduledDate = scheduled;
  }
  if (status !== undefined) {
    if (!POST_STATUSES.includes(status as PostStatus)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    data.status = status as PostStatus;
  }

  try {
    const post = await prisma.marketingPost.update({ where: { id }, data });
    res.json({ post });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Post not found" });
    throw err;
  }
});

router.post("/posts/:id/mark-posted", requireRole(...MARKETING_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    const post = await prisma.marketingPost.update({
      where: { id },
      data: { status: "POSTED", postedAt: new Date() },
    });
    res.json({ post });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Post not found" });
    throw err;
  }
});

router.delete("/posts/:id", requireRole(...MARKETING_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.marketingPost.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Post not found" });
    throw err;
  }
});

// ---- Cross-campaign calendar view ----
// Deliberately a flat, filterable list for the Content Calendar page - not a calendar-grid
// widget. Technet's real posting volume is low; see the Phase 1 scoping doc.

router.get("/posts", async (req, res) => {
  const { from, to, status, platform, campaignId } = req.query;

  const where: Prisma.MarketingPostWhereInput = {};
  if (typeof status === "string" && POST_STATUSES.includes(status as PostStatus)) {
    where.status = status as PostStatus;
  }
  if (typeof platform === "string" && MARKETING_PLATFORMS.includes(platform as (typeof MARKETING_PLATFORMS)[number])) {
    where.platform = platform;
  }
  if (typeof campaignId === "string" && campaignId) {
    where.campaignId = campaignId;
  }
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (fromDate || toDate) {
    where.scheduledDate = {};
    if (fromDate) where.scheduledDate.gte = fromDate;
    if (toDate) where.scheduledDate.lte = new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  const posts = await prisma.marketingPost.findMany({
    where,
    include: { campaign: { select: CAMPAIGN_SELECT } },
    orderBy: { scheduledDate: "asc" },
  });
  res.json({ posts });
});

export default router;
