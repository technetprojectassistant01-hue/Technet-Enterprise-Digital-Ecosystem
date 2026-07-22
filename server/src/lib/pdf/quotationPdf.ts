import PDFDocument from "pdfkit";
import { QUOTATION_CONDITIONS } from "./company";
import { drawItemsTable, drawLetterhead, drawTotals, type Money } from "./shared";

interface QuotationCustomer {
  name: string;
  company: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
}

export interface QuotationForPdf {
  quotationNumber: string;
  title: string;
  issuedAt: Date;
  vatRate: Money;
  subtotal: Money;
  vatAmount: Money;
  total: Money;
  customer: QuotationCustomer;
  items: { description: string; quantity: number; unitPrice: Money }[];
}

export function generateQuotationPdf(quotation: QuotationForPdf, signatoryName: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });

  // Page 1 — cover letter
  const dateStr = quotation.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  doc.font("Helvetica").fontSize(10);
  doc.text(`Date: ${dateStr}`);
  doc.text(`Ref: ${quotation.quotationNumber}`);
  doc.moveDown();
  doc.text("To:");
  doc.text(quotation.customer.company || quotation.customer.name);
  if (quotation.customer.address) doc.text(quotation.customer.address);
  doc.moveDown();
  doc.text(`Attn: ${quotation.customer.name}`);
  if (quotation.customer.phone) doc.text(`Tel: ${quotation.customer.phone}`);
  if (quotation.customer.email) doc.text(`Email: ${quotation.customer.email}`);
  doc.moveDown();
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown();

  doc.text("Dear Sir/Madam,");
  doc.moveDown();
  doc.font("Helvetica-Bold").text(`Re: ${quotation.title}`);
  doc.font("Helvetica").moveDown();
  doc.text("We refer to the above and are pleased to enclose herewith our best offer as detailed in the BOQ below.");
  doc.moveDown();
  doc.text("We trust our offer will meet your requirements and look forward to your favourable response.");
  doc.moveDown();
  doc.text("Thanking you and assuring you of our best attention at all times.");
  doc.moveDown(2);
  doc.text("Yours faithfully");
  doc.moveDown(2);
  doc.text(`For ${signatoryName}`);

  // Page 2 — BOQ
  doc.addPage();
  drawLetterhead(doc, "QUOTATION");
  doc.font("Helvetica-Bold").fontSize(10).text(quotation.title);
  doc.font("Helvetica").fontSize(9).text(`Quotation Ref: ${quotation.quotationNumber}`);
  doc.moveDown();
  drawItemsTable(doc, quotation.items);
  drawTotals(doc, quotation.subtotal, quotation.vatRate, quotation.vatAmount, quotation.total);

  doc.moveDown(3);
  doc
    .fontSize(9)
    .text(
      "I/We hereby approve the above quotation and authorise the company to proceed with the delivery & invoice accordingly.",
    );
  doc.moveDown(3);

  const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 3;
  const sigY = doc.y;
  doc.fontSize(8);
  doc.text("Read & Approved by", doc.page.margins.left, sigY, { width: colWidth, align: "center" });
  doc.text("Signature & Company seal", doc.page.margins.left + colWidth, sigY, { width: colWidth, align: "center" });
  doc.text("Date", doc.page.margins.left + colWidth * 2, sigY, { width: colWidth, align: "center" });

  // Page 3 — conditions of sale
  doc.addPage();
  drawLetterhead(doc, "CONDITIONS OF SALE");
  for (const condition of QUOTATION_CONDITIONS) {
    doc.font("Helvetica-Bold").fontSize(9).text(condition.label);
    doc.font("Helvetica").fontSize(9).text(condition.value);
    doc.moveDown();
  }

  doc.end();
  return doc;
}
