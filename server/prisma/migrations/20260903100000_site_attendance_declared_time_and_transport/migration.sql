-- The technician-typed arrival/departure time and the travel cost for each leg of a site visit.
--
-- checkInDeclaredTime/checkOutDeclaredTime sit alongside checkInAt/checkOutAt rather than
-- replacing them: the typed value is what the technician says, the timestamp is what the server
-- observed, and the trust reporting depends on keeping the second one untouched. Stored as an
-- "HH:MM" local wall-clock string, the same convention AttendanceRecord.clockIn already uses.
--
-- Every column is nullable and additive, so existing rows and the currently deployed server keep
-- working unchanged - safe to apply before the new application code ships.

ALTER TABLE "SiteAttendance" ADD COLUMN "checkInDeclaredTime" TEXT;
ALTER TABLE "SiteAttendance" ADD COLUMN "checkInTransportCost" DECIMAL(10,2);
ALTER TABLE "SiteAttendance" ADD COLUMN "checkOutDeclaredTime" TEXT;
ALTER TABLE "SiteAttendance" ADD COLUMN "checkOutTransportCost" DECIMAL(10,2);
