import PDFDocument from "pdfkit";
import { INVOICE_CONDITIONS } from "./company";
import { drawItemsTable, drawLetterhead, drawTotals, registerBrandFonts, type Money } from "./shared";

interface InvoiceCustomer {
  name: string;
  company: string | null;
  address: string | null;
  vatNumber: string | null;
  taxNumber: string | null;
}

export interface InvoiceForPdf {
  invoiceNumber: string;
  issueDate: Date;
  poReference: string | null;
  terms: string | null;
  vatRate: Money;
  subtotal: Money;
  vatAmount: Money;
  total: Money;
  customer: InvoiceCustomer;
  items: { description: string; quantity: number; unitPrice: Money }[];
}

export function generateInvoicePdf(invoice: InvoiceForPdf): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  registerBrandFonts(doc);
  doc.font("Body");

  drawLetterhead(doc, "VAT INVOICE");

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const boxTop = doc.y;
  const boxHeight = 90;

  // "Invoice To" box
  const toBoxWidth = (right - left) * 0.55;
  doc.rect(left, boxTop, toBoxWidth, boxHeight).stroke();
  doc.font("Body-Bold").fontSize(9).text("Invoice To", left + 8, boxTop + 6);
  doc.font("Body").fontSize(9);
  doc.text(invoice.customer.company || invoice.customer.name, left + 8, boxTop + 20, { width: toBoxWidth - 16 });
  if (invoice.customer.address) doc.text(invoice.customer.address, left + 8, doc.y, { width: toBoxWidth - 16 });
  const taxLine = [
    invoice.customer.taxNumber ? `BRN: ${invoice.customer.taxNumber}` : null,
    invoice.customer.vatNumber ? `VAT: ${invoice.customer.vatNumber}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
  if (taxLine) doc.text(taxLine, left + 8, boxTop + boxHeight - 14, { width: toBoxWidth - 16 });

  // Detail boxes: Inv Date / Invoice No / P.O. No / Terms
  const detailX = left + toBoxWidth + 10;
  const detailWidth = right - detailX;
  const rowH = boxHeight / 2;
  const dateStr = invoice.issueDate.toLocaleDateString("en-GB");

  function detailRow(idx: number, label1: string, val1: string, label2: string, val2: string) {
    const y = boxTop + idx * rowH;
    doc.rect(detailX, y, detailWidth / 2, rowH).stroke();
    doc.rect(detailX + detailWidth / 2, y, detailWidth / 2, rowH).stroke();
    doc.font("Body-Bold").fontSize(7);
    doc.text(label1, detailX + 4, y + 4);
    doc.text(label2, detailX + detailWidth / 2 + 4, y + 4);
    doc.font("Body").fontSize(9);
    doc.text(val1, detailX + 4, y + 14, { width: detailWidth / 2 - 8 });
    doc.text(val2, detailX + detailWidth / 2 + 4, y + 14, { width: detailWidth / 2 - 8 });
  }

  detailRow(0, "Inv Date", dateStr, "Invoice No", invoice.invoiceNumber);
  detailRow(1, "P.O. No.", invoice.poReference || "—", "Terms", invoice.terms || "Due on receipt");

  doc.y = boxTop + boxHeight + 20;
  drawItemsTable(doc, invoice.items);
  drawTotals(doc, invoice.subtotal, invoice.vatRate, invoice.vatAmount, invoice.total);

  doc.moveDown(2);
  doc.font("Body-Bold").fontSize(9).text("Conditions of Sale");
  doc.font("Body").fontSize(8);
  for (const condition of INVOICE_CONDITIONS) {
    doc.text(`•  ${condition}`, { width: (right - left) * 0.62 });
    doc.moveDown(0.3);
  }

  doc.end();
  return doc;
}
