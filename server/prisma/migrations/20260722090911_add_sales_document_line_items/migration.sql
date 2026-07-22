-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "taxNumber" TEXT,
ADD COLUMN     "vatNumber" TEXT;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "amount",
ADD COLUMN     "poReference" TEXT,
ADD COLUMN     "subtotal" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "terms" TEXT,
ADD COLUMN     "total" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "vatAmount" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "Quotation" DROP COLUMN "amount",
ADD COLUMN     "quotationNumber" TEXT NOT NULL,
ADD COLUMN     "subtotal" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "total" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "vatAmount" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quotationNumber_key" ON "Quotation"("quotationNumber");

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

