CREATE TABLE "AttendancePing" (
    "id" TEXT NOT NULL,
    "siteAttendanceId" TEXT NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "accuracyMeters" INTEGER,
    "deviceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendancePing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendancePing_siteAttendanceId_createdAt_idx" ON "AttendancePing"("siteAttendanceId", "createdAt");

ALTER TABLE "AttendancePing" ADD CONSTRAINT "AttendancePing_siteAttendanceId_fkey" FOREIGN KEY ("siteAttendanceId") REFERENCES "SiteAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
