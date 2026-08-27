-- Replace the unused/disconnected expiresAt date with a real validityDays field that actually
-- drives the PDF's "Validity" line, matching what every historical quotation already prints (15).

ALTER TABLE "Quotation" ADD COLUMN "validityDays" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Quotation" DROP COLUMN "expiresAt";
