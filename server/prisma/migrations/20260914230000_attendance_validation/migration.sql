-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_VALIDATION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_VALIDATED';
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_VALIDATION_REJECTED';

-- CreateEnum
CREATE TYPE "AttendanceValidationStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- CreateTable
CREATE TABLE "AttendanceValidation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceValidationStatus" NOT NULL DEFAULT 'PENDING',
    "fingerprint" TEXT,
    "note" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "AttendanceValidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceValidation_employeeId_idx" ON "AttendanceValidation"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceValidation_status_idx" ON "AttendanceValidation"("status");

-- AddForeignKey
ALTER TABLE "AttendanceValidation" ADD CONSTRAINT "AttendanceValidation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceValidation" ADD CONSTRAINT "AttendanceValidation_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
