-- New enum values. Not used by anything else in this migration: Postgres refuses an enum value
-- added in the same transaction, which is why the severity default stays STANDARD.
ALTER TYPE "AnomalySeverity" ADD VALUE 'LOW';
ALTER TYPE "AnomalySeverity" ADD VALUE 'MEDIUM';
ALTER TYPE "AnomalyStatus" ADD VALUE 'GENUINE';

CREATE TYPE "AnomalyType" AS ENUM ('AUDIT_STRIKES', 'FAR_FROM_JOB', 'UNVERIFIED_LOCATION', 'CHECKIN_NEAR_HOME', 'LEFT_WORK_AREA', 'MISSED_PING', 'IMPOSSIBLE_TRAVEL', 'MOCK_LOCATION_SUSPECTED', 'NO_GPS', 'LOW_ACCURACY', 'CLOCK_SKEW', 'TIME_MISMATCH', 'STATED_LOCATION_MISMATCH');

ALTER TABLE "AttendanceAnomaly" ADD COLUMN "type" "AnomalyType" NOT NULL DEFAULT 'AUDIT_STRIKES';
ALTER TABLE "AttendanceAnomaly" ADD COLUMN "siteAttendanceId" TEXT;
ALTER TABLE "AttendanceAnomaly" ADD COLUMN "details" JSONB;
ALTER TABLE "AttendanceAnomaly" ADD COLUMN "occurrenceCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AttendanceAnomaly" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AttendanceAnomaly" ALTER COLUMN "firstAuditId" DROP NOT NULL;
ALTER TABLE "AttendanceAnomaly" ALTER COLUMN "secondAuditId" DROP NOT NULL;

-- Existing audit-strike anomalies belong to the visit of their second (later) audit.
UPDATE "AttendanceAnomaly" a SET "siteAttendanceId" = au."siteAttendanceId"
FROM "AttendanceAudit" au WHERE au."id" = a."secondAuditId";

CREATE INDEX "AttendanceAnomaly_siteAttendanceId_type_idx" ON "AttendanceAnomaly"("siteAttendanceId", "type");

ALTER TABLE "AttendanceAnomaly" ADD CONSTRAINT "AttendanceAnomaly_siteAttendanceId_fkey" FOREIGN KEY ("siteAttendanceId") REFERENCES "SiteAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
