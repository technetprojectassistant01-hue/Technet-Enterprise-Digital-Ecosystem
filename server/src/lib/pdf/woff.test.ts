import { describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import { woffToSfnt } from "./woff";
import { CARLITO_REGULAR_BASE64 } from "./assets/fonts";

const woff = Buffer.from(CARLITO_REGULAR_BASE64, "base64");

describe("woffToSfnt", () => {
  it("unpacks the brand font into a plain TrueType font of the size the WOFF header declares", () => {
    const sfnt = woffToSfnt(woff);
    expect(sfnt.readUInt32BE(0)).toBe(woff.readUInt32BE(4)); // flavor
    expect(sfnt.readUInt16BE(4)).toBe(woff.readUInt16BE(12)); // numTables
    expect(sfnt.length).toBe(woff.readUInt32BE(16)); // totalSfntSize
  });

  it("leaves a font that isn't WOFF untouched", () => {
    const plain = Buffer.from("not a woff font");
    expect(woffToSfnt(plain)).toBe(plain);
  });

  it("gives PDFKit a font it can lay text out with, measuring the same as the WOFF", () => {
    const measure = (font: Buffer) => {
      const doc = new PDFDocument();
      doc.registerFont("Body", font);
      return doc.font("Body").fontSize(12).widthOfString("Technet Engineering - Attendance Report 0123456789");
    };
    expect(measure(woffToSfnt(woff))).toBeCloseTo(measure(woff), 5);
  });

  it("is fast: a PDF with the unpacked font builds in well under a second", async () => {
    const sfnt = woffToSfnt(woff);
    const start = Date.now();
    const doc = new PDFDocument();
    doc.registerFont("Body", sfnt);
    doc.font("Body").text("Hello Technet");
    const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));
    doc.on("data", () => {});
    doc.end();
    await done;
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
