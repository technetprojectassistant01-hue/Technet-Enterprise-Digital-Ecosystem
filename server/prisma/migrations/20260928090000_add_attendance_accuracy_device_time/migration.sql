ALTER TABLE "SiteAttendance" ADD COLUMN "checkInAccuracyMeters" INTEGER;
ALTER TABLE "SiteAttendance" ADD COLUMN "checkInDeviceAt" TIMESTAMP(3);
ALTER TABLE "SiteAttendance" ADD COLUMN "checkOutAccuracyMeters" INTEGER;
ALTER TABLE "SiteAttendance" ADD COLUMN "checkOutDeviceAt" TIMESTAMP(3);
