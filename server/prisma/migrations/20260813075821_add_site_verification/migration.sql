-- CreateEnum
CREATE TYPE "SiteVerificationStatus" AS ENUM ('ON_SITE', 'OUTSIDE_SITE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PhotoKind" ADD VALUE 'BEFORE';
ALTER TYPE "PhotoKind" ADD VALUE 'AFTER';

-- AlterTable
ALTER TABLE "InterventionReport" ADD COLUMN     "materialsUsed" TEXT;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "siteLat" DECIMAL(9,6),
ADD COLUMN     "siteLng" DECIMAL(9,6);

-- CreateTable
CREATE TABLE "SiteVerification" (
    "id" TEXT NOT NULL,
    "siteAttendanceId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "status" "SiteVerificationStatus" NOT NULL,
    "exitReason" TEXT,
    "exitReasonNote" TEXT,

    CONSTRAINT "SiteVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteVerification_siteAttendanceId_idx" ON "SiteVerification"("siteAttendanceId");

-- AddForeignKey
ALTER TABLE "SiteVerification" ADD CONSTRAINT "SiteVerification_siteAttendanceId_fkey" FOREIGN KEY ("siteAttendanceId") REFERENCES "SiteAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
