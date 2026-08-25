-- CreateEnum
CREATE TYPE "PaymentTermsTemplate" AS ENUM ('FULL_ON_CONFIRMATION', 'SPLIT_60_40_20', 'SPLIT_50_50');

-- CreateEnum
CREATE TYPE "QuotationAvailability" AS ENUM ('IN_STOCK', 'ORDER_PENDING');

-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('EMAIL', 'PHONE_CALL', 'REFERRER', 'PORTAL');

-- CreateEnum
CREATE TYPE "RequestCategory" AS ENUM ('NEW_EQUIPMENT_INSTALL', 'AC_INSTALL', 'PLUMBING_INSTALL', 'ELECTRICAL_INSTALL', 'SERVICING', 'REPAIRS', 'OTHER');

-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'QUOTATION';

-- DropForeignKey
ALTER TABLE "QuotationRequest" DROP CONSTRAINT "QuotationRequest_customerId_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "quotationId" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "availabilityStatus" "QuotationAvailability",
ADD COLUMN     "orderDays" INTEGER,
ADD COLUMN     "paymentTerms" "PaymentTermsTemplate" NOT NULL DEFAULT 'FULL_ON_CONFIRMATION',
ADD COLUMN     "poReference" TEXT;

-- AlterTable
ALTER TABLE "QuotationRequest" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "contactTitle" TEXT,
ADD COLUMN     "otherContactName" TEXT,
ADD COLUMN     "otherContactPhone" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "requestFor" "RequestCategory",
ADD COLUMN     "requestForOther" TEXT,
ADD COLUMN     "source" "RequestSource" NOT NULL DEFAULT 'PORTAL',
ALTER COLUMN "customerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "QuotationFollowUp" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spokenTo" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "callScheduledOn" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotationFollowUp_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QuotationFollowUp" ADD CONSTRAINT "QuotationFollowUp_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationFollowUp" ADD CONSTRAINT "QuotationFollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationRequest" ADD CONSTRAINT "QuotationRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

