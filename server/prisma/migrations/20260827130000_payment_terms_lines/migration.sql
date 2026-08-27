-- Replace the 3-fixed-preset paymentTerms enum with arbitrary label+percentage line items.

-- CreateTable
CREATE TABLE "QuotationPaymentTermsLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationPaymentTermsLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QuotationPaymentTermsLine" ADD CONSTRAINT "QuotationPaymentTermsLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing quotation's paymentTerms enum value becomes equivalent rows, using the
-- exact wording already shown in PAYMENT_TERMS_OPTIONS today.
INSERT INTO "QuotationPaymentTermsLine" ("id", "quotationId", "label", "percentage", "sortOrder")
SELECT gen_random_uuid(), "id", 'Confirmation', 100, 0
FROM "Quotation" WHERE "paymentTerms" = 'FULL_ON_CONFIRMATION';

INSERT INTO "QuotationPaymentTermsLine" ("id", "quotationId", "label", "percentage", "sortOrder")
SELECT gen_random_uuid(), "id", 'Confirmation', 60, 0
FROM "Quotation" WHERE "paymentTerms" = 'SPLIT_60_40_20';
INSERT INTO "QuotationPaymentTermsLine" ("id", "quotationId", "label", "percentage", "sortOrder")
SELECT gen_random_uuid(), "id", 'Progress', 40, 1
FROM "Quotation" WHERE "paymentTerms" = 'SPLIT_60_40_20';
INSERT INTO "QuotationPaymentTermsLine" ("id", "quotationId", "label", "percentage", "sortOrder")
SELECT gen_random_uuid(), "id", 'Completion', 20, 2
FROM "Quotation" WHERE "paymentTerms" = 'SPLIT_60_40_20';

INSERT INTO "QuotationPaymentTermsLine" ("id", "quotationId", "label", "percentage", "sortOrder")
SELECT gen_random_uuid(), "id", 'Confirmation', 50, 0
FROM "Quotation" WHERE "paymentTerms" = 'SPLIT_50_50';
INSERT INTO "QuotationPaymentTermsLine" ("id", "quotationId", "label", "percentage", "sortOrder")
SELECT gen_random_uuid(), "id", 'Completion', 50, 1
FROM "Quotation" WHERE "paymentTerms" = 'SPLIT_50_50';

-- DropColumn
ALTER TABLE "Quotation" DROP COLUMN "paymentTerms";

-- DropEnum
DROP TYPE "PaymentTermsTemplate";
