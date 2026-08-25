import type { Prisma } from "../../generated/prisma/client";
import { COMPANY } from "./company";
import { LOGO_ICON_BASE64 } from "./assets/logo";

const LOGO_BUFFER = Buffer.from(LOGO_ICON_BASE64, "base64");

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

  doc.image(LOGO_BUFFER, left, top, { width: 40 });
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#1a1a1a").text("TECHNET", left + 48, top - 2, { continued: true });
  doc.fillColor("#0891b2").text(" ENGINEERING");
  doc.font("Helvetica-Oblique").fontSize(6.5).fillColor("#555555").text(COMPANY.tagline, left + 48, top + 16);
  doc.fillColor("#000000");

  const addrX = left + 220;
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text(COMPANY.name, addrX, top, { width: right - addrX, align: "right" });
  doc.font("Helvetica").fontSize(8).fillColor("#333333");
  doc.text(COMPANY.addressLines.join(", "), addrX, doc.y, { width: right - addrX, align: "right" });
  doc.text(`Tel: ${COMPANY.tel}  Fax: ${COMPANY.fax}`, addrX, doc.y, { width: right - addrX, align: "right" });
  doc.text(`E: ${COMPANY.email} | ${COMPANY.website}`, addrX, doc.y, { width: right - addrX, align: "right" });
  doc.text(`BRN: ${COMPANY.brn}   VAT: ${COMPANY.vat}`, addrX, doc.y, { width: right - addrX, align: "right" });
  doc.fillColor("#000000");

  const afterHeaderY = Math.max(doc.y, top + 55);
  doc.moveTo(left, afterHeaderY + 6).lineTo(right, afterHeaderY + 6).strokeColor("#0891b2").lineWidth(2).stroke();
  doc.strokeColor("#000000").lineWidth(1);
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

  doc.rect(0, y, pageWidth, barHeight).fill("#0f2a33");
  doc.rect(0, y, pageWidth * 0.18, barHeight).fill("#0891b2");
  doc
    .font("Helvetica-Bold")
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

  ensureSpace(30);
  doc.rect(left, doc.y, width, 20).fill("#0891b2");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11).text(title, left, doc.y + 5, { width, align: "center" });
  doc.fillColor("#000000");
  doc.y += 20;

  for (const row of rows) {
    const valueHeight = doc.font("Helvetica").fontSize(8).heightOfString(row.value, { width: colValue - 12 });
    const rowHeight = Math.max(valueHeight + 10, 22);
    ensureSpace(rowHeight);
    const y = doc.y;
    doc.rect(left, y, colLabel, rowHeight).fillAndStroke("#f0f9fa", "#0891b2");
    doc.rect(left + colLabel, y, colValue, rowHeight).stroke("#0891b2");
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000").text(row.label, left + 6, y + 6, { width: colLabel - 12 });
    doc.font("Helvetica").fontSize(8).fillColor("#000000").text(row.value, left + colLabel + 6, y + 6, { width: colValue - 12 });
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
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
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
    doc.font("Helvetica").fontSize(9);
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
  const colNo = width * 0.06;
  const colDesc = width * 0.44;
  const colQty = width * 0.1;
  const colUnit = width * 0.2;
  const colAmount = width - colNo - colDesc - colQty - colUnit;

  function ensureSpace(rowHeight: number) {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }
  }

  const boxStartY = doc.y;

  // Title bar
  const titleHeight = refLine ? 32 : 20;
  doc.rect(left, boxStartY, width, titleHeight).fill("#e8f7f9");
  doc.fillColor("#000000").font("Helvetica-Bold").fontSize(10).text(title, left + 8, boxStartY + 6, { width: width - 16, align: "center" });
  if (refLine) {
    doc.font("Helvetica").fontSize(8).text(refLine, left + 8, boxStartY + 20, { width: width - 16, align: "center" });
  }
  doc.y = boxStartY + titleHeight;

  // Column header row
  const headerY = doc.y;
  doc.rect(left, headerY, width, 20).fill("#0891b2");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
  doc.text("Item", left + 4, headerY + 6, { width: colNo - 4 });
  doc.text("Description", left + colNo + 4, headerY + 6, { width: colDesc - 8 });
  doc.text("Qty", left + colNo + colDesc, headerY + 6, { width: colQty - 4, align: "right" });
  doc.text("Unit Price", left + colNo + colDesc + colQty, headerY + 6, { width: colUnit - 4, align: "right" });
  doc.text("Total", left + colNo + colDesc + colQty + colUnit, headerY + 6, { width: colAmount - 4, align: "right" });
  doc.fillColor("#000000");
  doc.y = headerY + 20;

  // Item rows
  items.forEach((item, index) => {
    const amount = Number(item.unitPrice) * item.quantity;
    const rowHeight = Math.max(doc.font("Helvetica").fontSize(9).heightOfString(item.description, { width: colDesc - 8 }), 12) + 10;
    ensureSpace(rowHeight);
    const y = doc.y;
    doc.font("Helvetica").fontSize(9);
    doc.text(String(index + 1).padStart(2, "0"), left + 4, y, { width: colNo - 4 });
    doc.text(item.description, left + colNo + 4, y, { width: colDesc - 8 });
    doc.text(String(item.quantity), left + colNo + colDesc, y, { width: colQty - 4, align: "right" });
    doc.text(formatMoney(item.unitPrice), left + colNo + colDesc + colQty, y, { width: colUnit - 4, align: "right" });
    doc.text(formatMoney(amount), left + colNo + colDesc + colQty + colUnit, y, { width: colAmount - 4, align: "right" });
    doc.moveTo(left, y + rowHeight).lineTo(right, y + rowHeight).strokeColor("#d0d0d0").lineWidth(0.5).stroke();
    doc.strokeColor("#000000").lineWidth(1);
    doc.y = y + rowHeight;
  });

  // Totals rows, inside the same box - label cell + value cell, matching the item table's columns
  const totalsLabelWidth = colNo + colDesc + colQty + colUnit;

  function totalsRow(label: string, value: string, bold: boolean) {
    const rowH = bold ? 22 : 18;
    ensureSpace(rowH);
    const y = doc.y;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 10 : 9);
    doc.text(label, left, y + (bold ? 6 : 4), { width: totalsLabelWidth - 8, align: "right" });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica-Oblique");
    doc.text(value, left + totalsLabelWidth, y + (bold ? 6 : 4), { width: colAmount - 8, align: "right" });
    doc.y = y + rowH;
  }

  totalsRow("Sub Total", formatMoney(subtotal), false);
  totalsRow(`VAT @ ${Number(vatRate)}%`, formatMoney(vatAmount), false);
  totalsRow("TOTAL (Incl. VAT)", formatMoney(total), true);

  // Outer border around the whole box (title + table + totals) - drawn last so it isn't
  // covered by any fills, spans exactly the content height just produced.
  doc.rect(left, boxStartY, width, doc.y - boxStartY).stroke("#0891b2");
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
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9);
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
