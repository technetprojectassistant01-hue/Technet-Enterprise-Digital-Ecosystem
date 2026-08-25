import type { Prisma } from "../../generated/prisma/client";
import { COMPANY } from "./company";
import { LOGO_ICON_BASE64 } from "./assets/logo";

const LOGO_BUFFER = Buffer.from(LOGO_ICON_BASE64, "base64");

export type Money = Prisma.Decimal | number | string;

export function formatMoney(value: Money): string {
  const n = Number(value);
  return `MUR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function drawLetterhead(doc: PDFKit.PDFDocument, title: string) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = doc.y;

  doc.image(LOGO_BUFFER, left, top, { width: 46 });

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text(COMPANY.name, left + 56, top);
  doc.font("Helvetica").fontSize(8).fillColor("#333333");
  doc.text(COMPANY.addressLines.join(", "), left + 56);
  doc.text(`VAT: ${COMPANY.vat} / BRN: ${COMPANY.brn}`, left + 56);
  doc.text(`Tel: ${COMPANY.tel} / Fax: ${COMPANY.fax}`, left + 56);
  doc.text(`Email: ${COMPANY.email}`, left + 56);
  doc.fillColor("#000000");

  doc.font("Helvetica-Bold").fontSize(18).text(title, left, top + 4, { width: right - left, align: "right" });

  const afterHeaderY = Math.max(doc.y, top + 60);
  doc.moveTo(left, afterHeaderY + 6).lineTo(right, afterHeaderY + 6).strokeColor("#0891b2").lineWidth(2).stroke();
  doc.strokeColor("#000000").lineWidth(1);
  doc.y = afterHeaderY + 16;
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
