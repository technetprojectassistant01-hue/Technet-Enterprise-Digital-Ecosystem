-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_ANOMALY_DETECTED';

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PENDING', 'CONFIRMED', 'MISSED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('STANDARD', 'HIGH');

-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('OPEN', 'CONFIRMED_VIOLATION', 'FALSE_POSITIVE', 'DISMISSED');

-- CreateTable
CREATE TABLE "AttendanceAudit" (
    "id" TEXT NOT NULL,
    "siteAttendanceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "pushSentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "status" "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "distanceMeters" INTEGER,
    "match" "LocationMatch",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAnomaly" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "firstAuditId" TEXT NOT NULL,
    "secondAuditId" TEXT NOT NULL,
    "severity" "AnomalySeverity" NOT NULL DEFAULT 'STANDARD',
    "status" "AnomalyStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceAudit_siteAttendanceId_idx" ON "AttendanceAudit"("siteAttendanceId");

-- CreateIndex
CREATE INDEX "AttendanceAudit_employeeId_idx" ON "AttendanceAudit"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceAudit_status_scheduledAt_idx" ON "AttendanceAudit"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "AttendanceAnomaly_employeeId_idx" ON "AttendanceAnomaly"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceAnomaly_status_idx" ON "AttendanceAnomaly"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceAnomaly_firstAuditId_key" ON "AttendanceAnomaly"("firstAuditId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceAnomaly_secondAuditId_key" ON "AttendanceAnomaly"("secondAuditId");

-- AddForeignKey
ALTER TABLE "AttendanceAudit" ADD CONSTRAINT "AttendanceAudit_siteAttendanceId_fkey" FOREIGN KEY ("siteAttendanceId") REFERENCES "SiteAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAudit" ADD CONSTRAINT "AttendanceAudit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAnomaly" ADD CONSTRAINT "AttendanceAnomaly_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAnomaly" ADD CONSTRAINT "AttendanceAnomaly_firstAuditId_fkey" FOREIGN KEY ("firstAuditId") REFERENCES "AttendanceAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAnomaly" ADD CONSTRAINT "AttendanceAnomaly_secondAuditId_fkey" FOREIGN KEY ("secondAuditId") REFERENCES "AttendanceAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAnomaly" ADD CONSTRAINT "AttendanceAnomaly_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
