-- DropIndex
DROP INDEX "InterventionReport_interventionNumber_key";

-- AlterTable
ALTER TABLE "InterventionReport" DROP COLUMN "interventionNumber",
ADD COLUMN     "sequenceNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "InterventionReport_sequenceNumber_key" ON "InterventionReport"("sequenceNumber");

