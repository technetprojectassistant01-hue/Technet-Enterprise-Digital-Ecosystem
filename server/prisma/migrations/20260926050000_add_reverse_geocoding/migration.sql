ALTER TABLE "SiteAttendance" ADD COLUMN "checkInPlace" TEXT;
ALTER TABLE "SiteAttendance" ADD COLUMN "checkOutPlace" TEXT;
ALTER TABLE "AttendanceAudit" ADD COLUMN "place" TEXT;

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "id" TEXT NOT NULL,
    "latKey" DECIMAL(8,5) NOT NULL,
    "lngKey" DECIMAL(8,5) NOT NULL,
    "placeName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeocodeCache_latKey_lngKey_key" ON "GeocodeCache"("latKey", "lngKey");
