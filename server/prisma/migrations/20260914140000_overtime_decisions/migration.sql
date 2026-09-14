-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'OVERTIME_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'OVERTIME_REJECTED';

-- CreateTable
CREATE TABLE "OvertimeDecision" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "status" "OvertimeStatus" NOT NULL,
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OvertimeDecision_date_idx" ON "OvertimeDecision"("date");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeDecision_employeeId_date_key" ON "OvertimeDecision"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "OvertimeDecision" ADD CONSTRAINT "OvertimeDecision_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeDecision" ADD CONSTRAINT "OvertimeDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

