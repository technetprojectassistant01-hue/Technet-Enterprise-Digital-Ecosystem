CREATE TABLE "SiteAttendancePhoto" (
    "id" TEXT NOT NULL,
    "siteAttendanceId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteAttendancePhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteAttendancePhoto_siteAttendanceId_key" ON "SiteAttendancePhoto"("siteAttendanceId");

CREATE INDEX "SiteAttendancePhoto_createdAt_idx" ON "SiteAttendancePhoto"("createdAt");

ALTER TABLE "SiteAttendancePhoto" ADD CONSTRAINT "SiteAttendancePhoto_siteAttendanceId_fkey" FOREIGN KEY ("siteAttendanceId") REFERENCES "SiteAttendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
