import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { isForeignKeyConstraintError, isNotFoundError } from "../lib/prismaErrors";
import { DOCUMENT_ROLES } from "../lib/roles";

const router = Router();

const CATEGORIES = ["CONTRACT", "INVOICE", "HR", "PROJECT", "GENERAL"] as const;
type DocumentCategory = (typeof CATEGORIES)[number];

const MAX_FILE_BYTES = 15 * 1024 * 1024;
// Unlike the intervention-report attachment (always a photo/PDF of a specific
// paper form), general business documents span many real formats — Office
// files, CAD drawings, archives, plain text. Block only executables rather
// than maintaining an allowlist that would reject legitimate uploads.
const BLOCKED_MIME = [
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
  "application/x-bat",
];

const DETAIL_SELECT = {
  id: true,
  title: true,
  category: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  projectId: true,
  project: { select: { id: true, name: true } },
  customerId: true,
  customer: { select: { id: true, name: true, company: true } },
  uploadedById: true,
  uploadedBy: { select: { id: true, name: true, email: true } },
  createdAt: true,
} satisfies Prisma.DocumentSelect;

function decodeDataUrl(input: unknown): { buffer: Buffer; mimeType: string } | null {
  if (typeof input !== "string" || !input) return null;
  const match = /^data:([^;]+);base64,(.+)$/.exec(input);
  if (!match) return null;
  const [, mimeType, data] = match;
  return { buffer: Buffer.from(data, "base64"), mimeType };
}

router.use(requireAuth);

router.get("/", async (req, res) => {
  const { category, projectId, customerId, search } = req.query;

  const where: Prisma.DocumentWhereInput = {};
  if (typeof category === "string" && CATEGORIES.includes(category as DocumentCategory)) {
    where.category = category as DocumentCategory;
  }
  if (typeof projectId === "string" && projectId) where.projectId = projectId;
  if (typeof customerId === "string" && customerId) where.customerId = customerId;
  if (typeof search === "string" && search.trim()) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { fileName: { contains: search, mode: "insensitive" } },
    ];
  }

  const documents = await prisma.document.findMany({
    where,
    select: DETAIL_SELECT,
    orderBy: { createdAt: "desc" },
  });
  res.json({ documents });
});

router.get("/:id/download", async (req, res) => {
  const id = req.params.id as string;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { data: true, mimeType: true, fileName: true },
  });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${doc.fileName}"`);
  res.send(Buffer.from(doc.data));
});

router.post("/", requireRole(...DOCUMENT_ROLES), async (req, res) => {
  const { title, category, projectId, customerId, fileData, fileName } = req.body ?? {};

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }
  if (category !== undefined && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }
  const file = decodeDataUrl(fileData);
  if (!file) return res.status(400).json({ error: "A file is required" });
  if (file.buffer.byteLength > MAX_FILE_BYTES) {
    return res.status(400).json({ error: "File must be 15MB or smaller" });
  }
  if (BLOCKED_MIME.includes(file.mimeType)) {
    return res.status(400).json({ error: "Executable files are not allowed" });
  }
  if (typeof fileName !== "string" || !fileName.trim()) {
    return res.status(400).json({ error: "fileName is required" });
  }

  try {
    const document = await prisma.document.create({
      data: {
        title: title.trim(),
        category: (category as DocumentCategory) || "GENERAL",
        data: file.buffer as unknown as Uint8Array<ArrayBuffer>,
        fileName: fileName.trim(),
        mimeType: file.mimeType,
        sizeBytes: file.buffer.byteLength,
        projectId: typeof projectId === "string" && projectId ? projectId : null,
        customerId: typeof customerId === "string" && customerId ? customerId : null,
        uploadedById: req.user!.sub,
      },
      select: DETAIL_SELECT,
    });
    res.status(201).json({ document });
  } catch (err) {
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Project or customer not found" });
    throw err;
  }
});

router.patch("/:id", requireRole(...DOCUMENT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  const { title, category, projectId, customerId } = req.body ?? {};

  if (category !== undefined && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  const data: Prisma.DocumentUpdateInput = {};
  if (typeof title === "string" && title.trim()) data.title = title.trim();
  if (category !== undefined) data.category = category as DocumentCategory;
  if (projectId !== undefined) data.project = projectId ? { connect: { id: projectId } } : { disconnect: true };
  if (customerId !== undefined) data.customer = customerId ? { connect: { id: customerId } } : { disconnect: true };

  try {
    const document = await prisma.document.update({ where: { id }, data, select: DETAIL_SELECT });
    res.json({ document });
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Document not found" });
    if (isForeignKeyConstraintError(err)) return res.status(400).json({ error: "Project or customer not found" });
    throw err;
  }
});

router.delete("/:id", requireRole(...DOCUMENT_ROLES), async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.document.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    if (isNotFoundError(err)) return res.status(404).json({ error: "Document not found" });
    throw err;
  }
});

export default router;
