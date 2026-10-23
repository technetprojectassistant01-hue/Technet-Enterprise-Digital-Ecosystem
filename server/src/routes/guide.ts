import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { generateGuidePdf, type GuidePdfBlock, type GuidePdfInput } from "../lib/pdf/guidePdf";

/**
 * The User Guide as a PDF (2026-10-23). The guide text is written in the client
 * (client/src/guide/) and shown from there, so the User Guide page sends the guide it is showing
 * and this lays it out on the letterhead. Any signed-in staff member may use it: the text is the
 * same guide they can already read, and the PDF goes back only to them.
 */
const router = Router();

/** Generous for the largest guide (the admin guide is about 60 KB of text). */
const MAX_TEXT = 400_000;

const isText = (value: unknown, max = 5_000): value is string => typeof value === "string" && value.length <= max;
const isItems = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 50 && value.every((item) => isText(item));

function parseBlock(value: unknown): GuidePdfBlock | null {
  if (!value || typeof value !== "object") return null;
  const block = value as Record<string, unknown>;
  if ((block.kind === "p" || block.kind === "tip" || block.kind === "note") && isText(block.text)) {
    return { kind: block.kind, text: block.text };
  }
  if ((block.kind === "steps" || block.kind === "list") && isItems(block.items)) {
    return { kind: block.kind, items: block.items };
  }
  return null;
}

/** The guide from the request body, or null when it isn't one. Exported for the tests. */
export function parseGuidePdfInput(body: unknown): GuidePdfInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (![b.title, b.intro, b.lastChecked, b.contents, b.pageLabel].every((v) => isText(v)) || !(b.title as string).trim()) return null;
  if (!Array.isArray(b.chapters) || b.chapters.length === 0 || b.chapters.length > 40) return null;
  if (JSON.stringify(b.chapters).length > MAX_TEXT) return null;

  const chapters: GuidePdfInput["chapters"] = [];
  for (const raw of b.chapters as unknown[]) {
    if (!raw || typeof raw !== "object") return null;
    const c = raw as Record<string, unknown>;
    if (!isText(c.title) || (c.intro !== undefined && !isText(c.intro)) || !Array.isArray(c.topics) || c.topics.length > 60) return null;
    const topics: GuidePdfInput["chapters"][number]["topics"] = [];
    for (const rawTopic of c.topics as unknown[]) {
      if (!rawTopic || typeof rawTopic !== "object") return null;
      const t = rawTopic as Record<string, unknown>;
      if (!isText(t.title) || !Array.isArray(t.blocks) || t.blocks.length > 60) return null;
      const blocks = (t.blocks as unknown[]).map(parseBlock);
      if (blocks.some((block) => !block)) return null;
      topics.push({ title: t.title, blocks: blocks as GuidePdfBlock[] });
    }
    chapters.push({ title: c.title, intro: c.intro as string | undefined, topics });
  }

  return {
    title: b.title as string,
    intro: b.intro as string,
    lastChecked: b.lastChecked as string,
    contents: b.contents as string,
    pageLabel: b.pageLabel as string,
    chapters,
  };
}

/** "Guide de l'administrateur" -> "guide-de-l-administrateur". */
export function guideFileName(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `technet-${slug || "user-guide"}.pdf`;
}

router.post("/pdf", requireAuth, (req, res) => {
  const guide = parseGuidePdfInput(req.body);
  if (!guide) return res.status(400).json({ error: "That isn't a user guide the app can print" });
  const doc = generateGuidePdf(guide);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${guideFileName(guide.title)}"`);
  doc.pipe(res);
});

export default router;
