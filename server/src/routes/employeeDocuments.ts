import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { PERSONAL_DOCUMENT_ROLES } from "../lib/roles";

/**
 * Personal documents (driving licence, ID card, passport, certificates…).
 *
 * - myDocumentsRouter (/api/my-documents): the signed-in employee uploads, lists, downloads and
 *   deletes their own. Any role — only a linked employee record is needed.
 * - employeeDocumentsRouter (/api/employee-documents): PERSONAL_DOCUMENT_ROLES (HR only, not ADMIN)
 *   list and download an employee's documents from the HR profile. Read-only.
 *
 * Deliberately separate from the business Documents module, which every office role can browse.
 */

export const DOCUMENT_TYPES = ["DRIVING_LICENCE", "NATIONAL_ID", "PASSPORT", "CERTIFICATE", "MEDICAL", "OTHER"] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Photos and scans only: these are pictures or PDFs of a card or certificate. */
function isAllowedMime(mime: string): boolean {
  return mime.startsWith("image/") || mime === "application/pdf";
}

const LIST_SELECT = {
  id: true,
  employeeId: true,
  type: true,
  title: true,
  expiryDate: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

function decodeDataUrl(input: unknown): { buffer: Buffer; mimeType: string } | null {
  if (typeof input !== "string" || !input) return null;
  const match = /^data:([^;]+);base64,(.+)$/.exec(input);
  if (!match) return null;
  return { buffer: Buffer.from(match[2], "base64"), mimeType: match[1] };
}

async function linkedEmployee(req: Request, res: Response) {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user!.sub }, select: { id: true } });
  if (!employee) {
    res.status(403).json({ error: "No employee record is linked to your account" });
    return null;
  }
  return employee;
}

async function sendFile(res: Response, where: { id: string; employeeId?: string }) {
  const doc = await prisma.employeeDocument.findFirst({ where, select: { data: true, mimeType: true, fileName: true } });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${doc.fileName.replace(/"/g, "")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.send(Buffer.from(doc.data));
}

export const myDocumentsRouter = Router();
myDocumentsRouter.use(requireAuth);

myDocumentsRouter.get("/", async (req, res) => {
  const employee = await linkedEmployee(req, res);
  if (!employee) return;
  const documents = await prisma.employeeDocument.findMany({
    where: { employeeId: employee.id },
    select: LIST_SELECT,
    orderBy: { createdAt: "desc" },
  });
  res.json({ documents });
});

myDocumentsRouter.post("/", async (req, res) => {
  const employee = await linkedEmployee(req, res);
  if (!employee) return;

  const { type, title, fileData, fileName } = req.body ?? {};
  if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "Give the document a name" });
  if (!DOCUMENT_TYPES.includes(type)) return res.status(400).json({ error: "Choose what kind of document this is" });
  const file = decodeDataUrl(fileData);
  if (!file) return res.status(400).json({ error: "Choose a file to upload" });
  if (!isAllowedMime(file.mimeType)) return res.status(400).json({ error: "Upload a photo or a PDF" });
  if (file.buffer.byteLength > MAX_FILE_BYTES) return res.status(400).json({ error: "File must be 10MB or smaller" });
  if (typeof fileName !== "string" || !fileName.trim()) return res.status(400).json({ error: "fileName is required" });

  const document = await prisma.employeeDocument.create({
    data: {
      employeeId: employee.id,
      type: type as DocumentType,
      title: title.trim().slice(0, 120),
      data: file.buffer as unknown as Uint8Array<ArrayBuffer>,
      fileName: fileName.trim().slice(0, 200),
      mimeType: file.mimeType,
      sizeBytes: file.buffer.byteLength,
      uploadedById: req.user!.sub,
    },
    select: LIST_SELECT,
  });
  res.status(201).json({ document });
});

myDocumentsRouter.get("/:id/download", async (req, res) => {
  const employee = await linkedEmployee(req, res);
  if (!employee) return;
  await sendFile(res, { id: req.params.id as string, employeeId: employee.id });
});

myDocumentsRouter.delete("/:id", async (req, res) => {
  const employee = await linkedEmployee(req, res);
  if (!employee) return;
  const deleted = await prisma.employeeDocument.deleteMany({ where: { id: req.params.id as string, employeeId: employee.id } });
  if (deleted.count === 0) return res.status(404).json({ error: "Document not found" });
  res.status(204).end();
});

export const employeeDocumentsRouter = Router();
employeeDocumentsRouter.use(requireAuth, requireRole(...PERSONAL_DOCUMENT_ROLES));

employeeDocumentsRouter.get("/", async (req, res) => {
  const { employeeId } = req.query;
  if (typeof employeeId !== "string" || !employeeId) return res.status(400).json({ error: "employeeId is required" });
  const documents = await prisma.employeeDocument.findMany({
    where: { employeeId },
    select: LIST_SELECT,
    orderBy: { createdAt: "desc" },
  });
  res.json({ documents });
});

employeeDocumentsRouter.get("/:id/download", async (req, res) => {
  await sendFile(res, { id: req.params.id as string });
});
