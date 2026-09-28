CREATE TABLE "KnownPlace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT,
    "address" TEXT,
    "lat" DECIMAL(9,6) NOT NULL,
    "lng" DECIMAL(9,6) NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 250,
    "timesConfirmed" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnownPlace_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SiteAttendance" ADD COLUMN "knownPlaceId" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN "siteFromCustomerAddress" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkOrder" ADD COLUMN "siteGeocodeAttemptedAt" TIMESTAMP(3);

CREATE INDEX "SiteAttendance_knownPlaceId_idx" ON "SiteAttendance"("knownPlaceId");

ALTER TABLE "KnownPlace" ADD CONSTRAINT "KnownPlace_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KnownPlace" ADD CONSTRAINT "KnownPlace_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SiteAttendance" ADD CONSTRAINT "SiteAttendance_knownPlaceId_fkey" FOREIGN KEY ("knownPlaceId") REFERENCES "KnownPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
