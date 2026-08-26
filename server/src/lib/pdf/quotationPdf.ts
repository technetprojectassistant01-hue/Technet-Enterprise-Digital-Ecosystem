import PDFDocument from "pdfkit";
import { QUOTATION_CONDITIONS, paymentTermsDescription } from "./company";
import { drawBoxedItemsTable, drawFooterBanner, drawKeyValueTable, drawLetterhead, ordinalDate, registerBrandFonts, type Money } from "./shared";

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
  contactPerson?: string | null;
  paymentTerms: string;
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
  registerBrandFonts(doc);
  doc.font("Body");

  // Page 1 — cover letter
  drawLetterhead(doc);
  const dateStr = ordinalDate(quotation.issuedAt);

  // Bold label / plain value pairs in a fixed-width label column, matching the real letterhead
  // template rather than plain "Label: value" strings.
  const labelX = doc.page.margins.left;
  const valueX = labelX + 42;
  const valueWidth = doc.page.width - doc.page.margins.right - valueX;
  function labelRow(label: string, value: string) {
    const y = doc.y;
    doc.font("Body-Bold").fontSize(10).text(label, labelX, y);
    doc.font("Body").fontSize(10).text(value, valueX, y, { width: valueWidth });
  }
  function indentedLine(value: string) {
    doc.font("Body").fontSize(10).text(value, valueX, doc.y, { width: valueWidth });
  }

  labelRow("Date:", dateStr);
  labelRow("Ref:", quotation.quotationNumber);
  doc.moveDown();
  labelRow("To:", "The Manager");
  indentedLine(quotation.customer.company || quotation.customer.name);
  if (quotation.customer.address) indentedLine(quotation.customer.address);
  doc.moveDown();
  if (quotation.contactPerson) labelRow("Attn:", quotation.contactPerson);
  if (quotation.customer.phone) labelRow("Tel:", quotation.customer.phone);
  if (quotation.customer.email) labelRow("Email:", quotation.customer.email);
  doc.moveDown();
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown();

  const greetingName = quotation.contactPerson ? quotation.contactPerson.trim().split(/\s+/)[0] : null;
  doc.text(greetingName ? `Dear ${greetingName},` : "Dear Sir/Madam,");
  doc.moveDown();
  doc.font("Body-Bold").text(`Re: ${quotation.title}`);
  doc.font("Body").moveDown();
  doc.text("We refer to the above and are pleased to enclose herewith our best offer as detailed in the BOQ below.");
  doc.moveDown();
  doc.text("Trust our offer of interest and we await your further favourable instructions.");
  doc.moveDown();
  doc.text("Thanking you and assuring you of our best attention at all times.");
  doc.moveDown(2);
  doc.text("Yours faithfully,");
  doc.moveDown(2);
  doc.text(signatoryName);
  drawFooterBanner(doc);

  // Page 2 — BOQ
  doc.addPage();
  drawLetterhead(doc);
  drawBoxedItemsTable(
    doc,
    quotation.title,
    `Ref: ${quotation.quotationNumber}`,
    quotation.items,
    quotation.subtotal,
    quotation.vatRate,
    quotation.vatAmount,
    quotation.total,
  );

  doc.moveDown(2);
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
  drawFooterBanner(doc);

  // Page 3 — conditions of sale
  doc.addPage();
  drawLetterhead(doc);
  // "Terms of payments" is inserted after Exchange Rate, matching the company's own template order.
  const rows = [...QUOTATION_CONDITIONS];
  rows.splice(2, 0, { label: "Terms of payments", value: paymentTermsDescription(quotation.paymentTerms) });
  drawKeyValueTable(doc, "Conditions of Sales", rows);
  drawFooterBanner(doc);

  doc.end();
  return doc;
}
