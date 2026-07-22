-- CreateEnum
CREATE TYPE "ReminderInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('EQUIPMENT', 'WORK_DONE');

-- DropForeignKey
ALTER TABLE "InterventionReport" DROP CONSTRAINT "InterventionReport_workOrderId_fkey";

-- AlterTable
ALTER TABLE "InterventionReport" ADD COLUMN     "additionalInfo" TEXT,
ADD COLUMN     "customerId" TEXT NOT NULL,
ADD COLUMN     "nextReminderAt" TIMESTAMP(3),
ADD COLUMN     "reminderInterval" "ReminderInterval",
ADD COLUMN     "workType" "ServiceCategory" NOT NULL,
ALTER COLUMN "workOrderId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "InterventionReportPhoto" (
    "id" TEXT NOT NULL,
    "interventionReportId" TEXT NOT NULL,
    "kind" "PhotoKind" NOT NULL,
    "data" BYTEA NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionReportPhoto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InterventionReport" ADD CONSTRAINT "InterventionReport_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionReport" ADD CONSTRAINT "InterventionReport_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionReportPhoto" ADD CONSTRAINT "InterventionReportPhoto_interventionReportId_fkey" FOREIGN KEY ("interventionReportId") REFERENCES "InterventionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

