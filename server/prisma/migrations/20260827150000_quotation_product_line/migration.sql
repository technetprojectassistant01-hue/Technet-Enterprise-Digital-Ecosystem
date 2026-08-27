-- Internal-only background categorization field, never printed in the PDF. No lookup table yet -
-- deliberately deferred (see schema.prisma comment).

ALTER TABLE "Quotation" ADD COLUMN "productLine" TEXT;
