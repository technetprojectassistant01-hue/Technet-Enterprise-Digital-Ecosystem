import type { Prisma } from "../../generated/prisma/client";
import { COMPANY } from "./company";
import { LOGO_LOCKUP_BASE64 } from "./assets/logo";
import {
  CARLITO_REGULAR_BASE64,
  CARLITO_BOLD_BASE64,
  CARLITO_ITALIC_BASE64,
  CARLITO_BOLDITALIC_BASE64,
} from "./assets/fonts";

const LOGO_BUFFER = Buffer.from(LOGO_LOCKUP_BASE64, "base64");
/** Real aspect ratio of the cropped lockup PNG (720x406) - height = width * this. */
const LOGO_ASPECT = 406 / 720;
const LOGO_WIDTH = 170;
const LOGO_HEIGHT = LOGO_WIDTH * LOGO_ASPECT;

/** Carlito is metrically-compatible, openly-licensed stand-in for Calibri - the actual font
 * embedded in every real Technet-issued quotation/invoice (confirmed by inspecting the fonts
 * embedded in a real reference PDF the user supplied). Calibri itself is a proprietary Microsoft
 * font with no redistributable file, so it can't be embedded directly. Call once per document. */
export function registerBrandFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont("Body", Buffer.from(CARLITO_REGULAR_BASE64, "base64"));
  doc.registerFont("Body-Bold", Buffer.from(CARLITO_BOLD_BASE64, "base64"));
  doc.registerFont("Body-Italic", Buffer.from(CARLITO_ITALIC_BASE64, "base64"));
  doc.registerFont("Body-BoldItalic", Buffer.from(CARLITO_BOLDITALIC_BASE64, "base64"));
}

export type Money = Prisma.Decimal | number | string;

export function formatMoney(value: Money): string {
  const n = Number(value);
  return `MUR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The real Technet letterhead carries no separate "document type" label - just the logo and
 * address block; the document identifies itself via the boxed table headers further down the
 * page. `title` is accepted for callers that want it available but is not rendered here. */
export function drawLetterhead(doc: PDFKit.PDFDocument, _title?: string) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = doc.y;

  // Single combined image (icon + "TECHNET ENGINEERING" wordmark + tagline), cropped from the
  // company's real issued-quotation letterhead rather than redrawn as separate text - the icon
  // and "T" of the wordmark are one integrated device in the real logo, not reproducible with
  // PDFKit's built-in fonts alone.
  doc.image(LOGO_BUFFER, left, top, { width: LOGO_WIDTH });

  const addrX = left + LOGO_WIDTH + 20;
  doc.font("Body-Bold").fontSize(11).fillColor("#000000").text(COMPANY.name, addrX, top, { width: right - addrX, align: "right" });
  doc.font("Body").fontSize(8).fillColor("#333333");
  doc.text(COMPANY.addressLines.join(", "), addrX, doc.y, { width: right - addrX, align: "right" });
  doc.text(`Tel: ${COMPANY.tel}  Fax: ${COMPANY.fax}`, addrX, doc.y, { width: right - addrX, align: "right" });
  doc.text(`E: ${COMPANY.email} | ${COMPANY.website}`, addrX, doc.y, { width: right - addrX, align: "right" });
  doc.text(`BRN: ${COMPANY.brn}   VAT: ${COMPANY.vat}`, addrX, doc.y, { width: right - addrX, align: "right" });
  doc.fillColor("#000000");

  const afterHeaderY = Math.max(doc.y, top + LOGO_HEIGHT);
  doc.y = afterHeaderY + 16;
}

/** Thin branded bar at the very bottom of the current page - call once per page, after content.
 * Draws below the normal bottom margin, which would otherwise make PDFKit think the text doesn't
 * fit and silently insert a blank page - temporarily zeroing the bottom margin avoids that. */
export function drawFooterBanner(doc: PDFKit.PDFDocument) {
  const pageWidth = doc.page.width;
  const barHeight = 22;
  const y = doc.page.height - barHeight;
  const savedBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.rect(0, y, pageWidth, barHeight).fill("#0d5c70");
  doc.rect(0, y, pageWidth * 0.18, barHeight).fill("#01bbd2");
  doc
    .font("Body-Bold")
    .fontSize(8)
    .fillColor("#ffffff")
    .text("Building Services  |  ELV & Security  |  Engineering Solutions", 0, y + 7, { width: pageWidth - 20, align: "right" });
  doc.fillColor("#000000");

  doc.page.margins.bottom = savedBottomMargin;
}

const ORDINAL_SUFFIX: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
export function ordinalDate(date: Date): string {
  const day = date.getDate();
  const suffix = day >= 11 && day <= 13 ? "th" : ORDINAL_SUFFIX[day % 10] || "th";
  const rest = date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `${day}${suffix} ${rest}`;
}

export interface KeyValueRow {
  label: string;
  value: string;
}

/** A bordered two-column label/value table, matching the company's own "Conditions of Sale" template. */
export function drawKeyValueTable(doc: PDFKit.PDFDocument, title: string, rows: KeyValueRow[]) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const colLabel = width * 0.22;
  const colValue = width - colLabel;

  function ensureSpace(rowHeight: number) {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
  }

  // Title/body font sizes (14pt / 10pt) taken directly from the real reference PDF's own text
  // layout, not eyeballed.
  ensureSpace(34);
  doc.rect(left, doc.y, width, 26).fillAndStroke("#daeef3", "#5fb8c9");
  doc.fillColor("#000000").font("Body-Bold").fontSize(14).text(title, left, doc.y + 6, { width, align: "center", underline: true });
  doc.y += 26;

  for (const row of rows) {
    const valueHeight = doc.font("Body").fontSize(10).heightOfString(row.value, { width: colValue - 12 });
    const rowHeight = Math.max(valueHeight + 8, 24);
    ensureSpace(rowHeight);
    const y = doc.y;
    doc.rect(left, y, colLabel, rowHeight).stroke("#5fb8c9");
    doc.rect(left + colLabel, y, colValue, rowHeight).stroke("#5fb8c9");
    doc.font("Body-Bold").fontSize(10).fillColor("#000000").text(row.label, left + 6, y + 6, { width: colLabel - 12 });
    doc.font("Body").fontSize(10).fillColor("#000000").text(row.value, left + colLabel + 6, y + 6, { width: colValue - 12 });
    doc.y = y + rowHeight;
  }
  doc.x = left;
}

export interface PdfLineItem {
  description: string;
  quantity: number;
  unitPrice: Money;
}

export function drawItemsTable(doc: PDFKit.PDFDocument, items: PdfLineItem[]) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const colNo = width * 0.06;
  const colDesc = width * 0.44;
  const colQty = width * 0.1;
  const colUnit = width * 0.2;
  const colAmount = width * 0.2;

  function ensureSpace(rowHeight: number) {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
  }

  function headerRow() {
    const y = doc.y;
    doc.rect(left, y, width, 20).fill("#0891b2");
    doc.fillColor("#ffffff").font("Body-Bold").fontSize(9);
    doc.text("No.", left + 4, y + 6, { width: colNo - 4 });
    doc.text("Description", left + colNo, y + 6, { width: colDesc - 4 });
    doc.text("Qty", left + colNo + colDesc, y + 6, { width: colQty - 4, align: "right" });
    doc.text("Unit Price", left + colNo + colDesc + colQty, y + 6, { width: colUnit - 4, align: "right" });
    doc.text("Total Amount", left + colNo + colDesc + colQty + colUnit, y + 6, { width: colAmount - 4, align: "right" });
    doc.fillColor("#000000");
    doc.y = y + 24;
  }

  headerRow();

  items.forEach((item, index) => {
    const amount = Number(item.unitPrice) * item.quantity;
    const rowHeight = Math.max(doc.heightOfString(item.description, { width: colDesc - 8 }), 14) + 10;
    ensureSpace(rowHeight);
    const y = doc.y;
    doc.font("Body").fontSize(9);
    doc.text(String(index + 1).padStart(2, "0"), left + 4, y, { width: colNo - 4 });
    doc.text(item.description, left + colNo, y, { width: colDesc - 4 });
    doc.text(String(item.quantity), left + colNo + colDesc, y, { width: colQty - 4, align: "right" });
    doc.text(formatMoney(item.unitPrice), left + colNo + colDesc + colQty, y, { width: colUnit - 4, align: "right" });
    doc.text(formatMoney(amount), left + colNo + colDesc + colQty + colUnit, y, { width: colAmount - 4, align: "right" });
    const nextY = y + rowHeight;
    doc.moveTo(left, nextY - 4).lineTo(right, nextY - 4).strokeColor("#e5e5e5").lineWidth(0.5).stroke();
    doc.strokeColor("#000000").lineWidth(1);
    doc.y = nextY;
  });

  doc.x = left;
  doc.y += 6;
}

/** The company's own quotation template puts the BOQ title, item table, and totals all inside
 * one continuous bordered box (not separate floating elements) - matches that shape. Only used
 * for quotations; Invoice/PO keep the simpler drawItemsTable + drawTotals combination. */
export function drawBoxedItemsTable(
  doc: PDFKit.PDFDocument,
  title: string,
  refLine: string | null | undefined,
  items: PdfLineItem[],
  subtotal: Money,
  vatRate: Money,
  vatAmount: Money,
  total: Money,
) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  // Column proportions and font size (11pt) measured directly off the real reference PDF's own
  // text/cell coordinates (via pdfminer), not eyeballed - the Description column in particular is
  // considerably wider, and Qty considerably narrower, than the earlier visual-only guess.
  const colNo = width * 0.077;
  const colDesc = width * 0.523;
  const colQty = width * 0.065;
  const colUnit = width * 0.149;
  const colAmount = width - colNo - colDesc - colQty - colUnit;
  const FONT_SIZE = 11;
  const LINE_HEIGHT = FONT_SIZE * 1.2;

  function ensureSpace(rowHeight: number) {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
  }

  const GRID = "#5fb8c9";
  const PALE = "#daeef3";
  const colX = [left, left + colNo, left + colNo + colDesc, left + colNo + colDesc + colQty, left + colNo + colDesc + colQty + colUnit, right];

  function vGrid(y0: number, y1: number) {
    for (const x of colX) doc.moveTo(x, y0).lineTo(x, y1).strokeColor(GRID).lineWidth(0.75).stroke();
  }

  function formatNumber(value: Money): string {
    return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const boxStartY = doc.y;

  // Title bar - 14pt title / 11pt ref line, matching the real document.
  const titleHeight = refLine ? 38 : 26;
  doc.rect(left, boxStartY, width, titleHeight).fill(PALE);
  doc.fillColor("#000000").font("Body-Bold").fontSize(14).text(title, left + 8, boxStartY + 8, { width: width - 16, align: "center" });
  if (refLine) {
    doc.font("Body").fontSize(11).text(refLine, left + 8, boxStartY + 26, { width: width - 16, align: "center" });
  }
  doc.y = boxStartY + titleHeight;

  // Column header row - currency unit lives in the header, not repeated on every row. Every
  // header label is center-aligned within its column, matching the real document exactly.
  const headerY = doc.y;
  const headerHeight = 30;
  doc.rect(left, headerY, width, headerHeight).fill(PALE);
  doc.fillColor("#000000").font("Body-Bold").fontSize(FONT_SIZE);
  doc.text("Item", left, headerY + 9, { width: colNo, align: "center" });
  doc.text("Description", left + colNo, headerY + 9, { width: colDesc, align: "center" });
  doc.text("Qty", left + colNo + colDesc, headerY + 9, { width: colQty, align: "center" });
  doc.text("Unit Price\n(MUR)", left + colNo + colDesc + colQty, headerY + 4, { width: colUnit, align: "center" });
  doc.text("Total\n(MUR)", left + colNo + colDesc + colQty + colUnit, headerY + 4, { width: colAmount, align: "center" });
  doc.y = headerY + headerHeight;
  vGrid(headerY, doc.y);
  doc.moveTo(left, headerY).lineTo(right, headerY).strokeColor(GRID).lineWidth(0.75).stroke();

  // Item rows - Item/Qty/Unit Price/Total are vertically centered against a multi-line
  // Description, matching the real document's table (a plain Word-table default), not top-aligned.
  items.forEach((item, index) => {
    const amount = Number(item.unitPrice) * item.quantity;
    const rowHeight = Math.max(doc.font("Body").fontSize(FONT_SIZE).heightOfString(item.description, { width: colDesc - 8 }), LINE_HEIGHT) + 6;
    ensureSpace(rowHeight);
    const y = doc.y;
    const centerY = y + (rowHeight - LINE_HEIGHT) / 2;
    doc.font("Body").fontSize(FONT_SIZE);
    doc.text(`${index + 1}.0`, left + 4, centerY, { width: colNo - 4 });
    doc.text(item.description, left + colNo + 4, y + 3, { width: colDesc - 8 });
    doc.text(String(item.quantity), left + colNo + colDesc, centerY, { width: colQty, align: "center" });
    doc.text(formatNumber(item.unitPrice), left + colNo + colDesc + colQty, centerY, { width: colUnit - 4, align: "right" });
    doc.text(formatNumber(amount), left + colNo + colDesc + colQty + colUnit, centerY, { width: colAmount - 4, align: "right" });
    const nextY = y + rowHeight;
    vGrid(y, nextY);
    doc.moveTo(left, nextY).lineTo(right, nextY).strokeColor(GRID).lineWidth(0.75).stroke();
    doc.y = nextY;
  });

  // Totals rows, inside the same box - label cell + value cell, matching the item table's columns,
  // shaded the same pale blue as the header to set them apart from the white item rows.
  const totalsLabelWidth = colNo + colDesc + colQty + colUnit;

  function totalsRow(label: string, value: string, bold: boolean) {
    const rowH = bold ? 22 : 19;
    ensureSpace(rowH);
    const y = doc.y;
    doc.rect(left, y, width, rowH).fill(PALE);
    doc.font(bold ? "Body-Bold" : "Body").fontSize(FONT_SIZE).fillColor("#000000");
    doc.text(label, left, y + (bold ? 6 : 4), { width: totalsLabelWidth - 8, align: "right" });
    doc.font(bold ? "Body-Bold" : "Body-Italic");
    doc.text(value, left + totalsLabelWidth, y + (bold ? 6 : 4), { width: colAmount - 4, align: "right" });
    const nextY = y + rowH;
    doc.moveTo(left + totalsLabelWidth, y).lineTo(left + totalsLabelWidth, nextY).strokeColor(GRID).lineWidth(0.75).stroke();
    doc.moveTo(left, nextY).lineTo(right, nextY).strokeColor(GRID).lineWidth(0.75).stroke();
    doc.y = nextY;
  }

  totalsRow("Sub Total", formatNumber(subtotal), false);
  totalsRow(`VAT @ ${Number(vatRate)}%`, formatNumber(vatAmount), false);
  totalsRow("TOTAL (Incl. VAT)", formatNumber(total), true);

  // Outer border around the whole box (title + table + totals) - drawn last so it isn't
  // covered by any fills, spans exactly the content height just produced.
  doc.rect(left, boxStartY, width, doc.y - boxStartY).stroke(GRID);
  doc.fillColor("#000000");
  doc.x = left;
  doc.y += 10;
}

export function drawTotals(
  doc: PDFKit.PDFDocument,
  subtotal: Money,
  vatRate: Money,
  vatAmount: Money,
  total: Money,
) {
  const right = doc.page.width - doc.page.margins.right;
  const boxWidth = 220;
  const left = right - boxWidth;
  let y = doc.y + 8;

  if (y + 70 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }

  function line(label: string, value: string, bold = false) {
    doc.font(bold ? "Body-Bold" : "Body").fontSize(bold ? 11 : 9);
    doc.text(label, left, y, { width: boxWidth * 0.5 });
    doc.text(value, left + boxWidth * 0.5, y, { width: boxWidth * 0.5, align: "right" });
    y += bold ? 20 : 16;
  }

  line("Subtotal", formatMoney(subtotal));
  line(`VAT @ ${Number(vatRate)}%`, formatMoney(vatAmount));
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#0891b2").lineWidth(1).stroke();
  doc.strokeColor("#000000");
  y += 4;
  line("Total", formatMoney(total), true);

  doc.x = doc.page.margins.left;
  doc.y = y + 10;
}
