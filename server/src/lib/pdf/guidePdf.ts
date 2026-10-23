import PDFDocument from "pdfkit";
import { drawFooterBanner, drawLetterhead, registerBrandFonts } from "./shared";

/**
 * The User Guide as a PDF (2026-10-23): the guide a person sees at /dashboard/guide, in the
 * language they see it in, on the Technet letterhead. The guide text lives in the client
 * (client/src/guide/), so the page sends it here and this only lays it out - see routes/guide.ts.
 */

export type GuidePdfBlock =
  | { kind: "p" | "tip" | "note"; text: string }
  | { kind: "steps" | "list"; items: string[] };

export interface GuidePdfInput {
  title: string;
  intro: string;
  /** Already worded and dated, e.g. "Last checked against the app on 22 October 2026." */
  lastChecked: string;
  /** The heading of the table of contents, e.g. "Contents". */
  contents: string;
  /** Page footer, with {n} and {total} in place of the numbers, e.g. "Page {n} of {total}". */
  pageLabel: string;
  chapters: { title: string; intro?: string; topics: { title: string; blocks: GuidePdfBlock[] }[] }[];
}

const TEAL = "#0d5c70";
const CYAN = "#01bbd2";
const AMBER = "#d18b00";
const TEXT = "#222222";
const MUTED = "#555555";

/** Characters the guides use that the brand font can't draw, and what to print instead. */
const SUBSTITUTES: Record<string, string> = { "⋯": "···" };
const printable = (text: string) => text.replace(/[⋯]/g, (ch) => SUBSTITUTES[ch] ?? ch);

/** The guide with every piece of text made printable. */
function printableGuide(input: GuidePdfInput): GuidePdfInput {
  const block = (b: GuidePdfBlock): GuidePdfBlock => ("items" in b ? { ...b, items: b.items.map(printable) } : { ...b, text: printable(b.text) });
  return {
    ...input,
    title: printable(input.title),
    intro: printable(input.intro),
    chapters: input.chapters.map((c) => ({
      title: printable(c.title),
      intro: c.intro && printable(c.intro),
      topics: c.topics.map((t) => ({ title: printable(t.title), blocks: t.blocks.map(block) })),
    })),
  };
}

export function generateGuidePdf(guide: GuidePdfInput): PDFKit.PDFDocument {
  const input = printableGuide(guide);
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, left: 50, right: 50, bottom: 60 },
    bufferPages: true,
    info: { Title: input.title, Author: "Technet Engineering" },
  });
  registerBrandFonts(doc);

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  /** Start a new page when fewer than `needed` points are left, so a heading isn't left alone at the
   * bottom. A new page resets the text colour, so set the font and colour after calling this. */
  const keep = (needed: number) => {
    if (doc.y + needed > bottom()) doc.addPage();
  };

  // ---- Cover: letterhead, title, intro and the contents ----
  drawLetterhead(doc);
  doc.moveDown(1.5);
  doc.font("Body-Bold").fontSize(24).fillColor(TEAL).text(input.title, left, doc.y, { width });
  doc.moveDown(0.4);
  doc.font("Body").fontSize(11).fillColor(TEXT).text(input.intro, { width, lineGap: 2 });
  doc.moveDown(0.4);
  doc.font("Body-Italic").fontSize(9).fillColor(MUTED).text(input.lastChecked, { width });

  doc.moveDown(1.5);
  doc.font("Body-Bold").fontSize(14).fillColor(TEAL).text(input.contents, { width });
  doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).strokeColor(CYAN).lineWidth(1).stroke();
  doc.moveDown(0.6);
  input.chapters.forEach((chapter, ci) => {
    keep(30);
    doc.font("Body-Bold").fontSize(10.5).fillColor(TEXT).text(`${ci + 1}. ${chapter.title}`, left, doc.y, { width });
    chapter.topics.forEach((topic, ti) => {
      keep(14);
      doc.font("Body").fontSize(9.5).fillColor(MUTED).text(`${ci + 1}.${ti + 1}  ${topic.title}`, left + 16, doc.y, { width: width - 16 });
    });
    doc.moveDown(0.5);
  });

  // ---- The chapters, after the contents page. Each follows on from the last, on a new page only
  // when little room is left, so a short chapter end doesn't leave a page almost empty. ----
  doc.addPage();
  input.chapters.forEach((chapter, ci) => {
    if (ci > 0) {
      doc.moveDown(1.5);
      keep(150);
    }
    doc.font("Body-Bold").fontSize(18).fillColor(TEAL).text(`${ci + 1}. ${chapter.title}`, left, doc.y, { width });
    doc.moveTo(left, doc.y + 2).lineTo(left + width, doc.y + 2).strokeColor(CYAN).lineWidth(1.5).stroke();
    doc.moveDown(0.6);
    if (chapter.intro) {
      doc.font("Body").fontSize(10.5).fillColor(MUTED).text(chapter.intro, left, doc.y, { width, lineGap: 2 });
      doc.moveDown(0.6);
    }

    chapter.topics.forEach((topic, ti) => {
      keep(60);
      doc.moveDown(0.4);
      doc.font("Body-Bold").fontSize(13).fillColor(TEXT).text(`${ci + 1}.${ti + 1}  ${topic.title}`, left, doc.y, { width });
      doc.moveDown(0.3);
      topic.blocks.forEach((block) => drawBlock(doc, block, left, width, keep));
    });
  });

  // ---- Page number and branded banner on every page ----
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const label = input.pageLabel.replace("{n}", String(i - range.start + 1)).replace("{total}", String(range.count));
    doc
      .font("Body")
      .fontSize(8)
      .fillColor(MUTED)
      .text(`${input.title} — ${label}`, left, doc.page.height - 40, { width, align: "center", lineBreak: false });
    doc.page.margins.bottom = savedBottom;
    drawFooterBanner(doc);
  }

  doc.end();
  return doc;
}

function drawBlock(doc: PDFKit.PDFDocument, block: GuidePdfBlock, left: number, width: number, keep: (needed: number) => void) {
  doc.font("Body").fontSize(10.5);
  const textOptions = { width, lineGap: 1.5 };

  switch (block.kind) {
    case "p":
      keep(16);
      doc.fillColor(TEXT).text(block.text, left, doc.y, textOptions);
      break;
    case "steps":
    case "list":
      block.items.forEach((item, i) => {
        keep(16);
        const marker = block.kind === "steps" ? `${i + 1}.` : "•";
        const y = doc.y;
        doc.font(block.kind === "steps" ? "Body-Bold" : "Body").fillColor(block.kind === "steps" ? TEAL : MUTED);
        doc.text(marker, left + 4, y, { width: 18 });
        doc.font("Body").fillColor(TEXT).text(item, left + 22, y, { ...textOptions, width: width - 22 });
        doc.moveDown(0.15);
      });
      break;
    case "tip":
    case "note": {
      // A tinted box with a coloured bar down the left, like the on-screen tip and note.
      const colour = block.kind === "tip" ? CYAN : AMBER;
      const pad = 8;
      const innerWidth = width - pad * 2 - 4;
      const height = doc.heightOfString(block.text, { width: innerWidth, lineGap: 1.5 }) + pad * 2;
      keep(height + 4);
      const top = doc.y;
      doc.save();
      doc.rect(left, top, width, height).fillOpacity(0.08).fill(colour);
      doc.restore();
      doc.rect(left, top, 3, height).fill(colour);
      doc.fillColor(TEXT).text(block.text, left + pad + 4, top + pad, { width: innerWidth, lineGap: 1.5 });
      doc.y = top + height;
      break;
    }
  }
  doc.moveDown(0.5);
}
