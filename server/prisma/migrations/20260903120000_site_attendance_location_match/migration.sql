-- Whether the place a technician typed at check-in/check-out matches where their GPS put them.
--
-- UNCHECKABLE is the expected outcome most of the time and is not a suspicion: free text like
-- "Office" or "Closed early" has no coordinates to compare against, and OpenStreetMap does not
-- resolve business names either (CLAUDE.md §7b). Only a resolvable place name can be checked.
--
-- Additive and nullable, so existing rows and the currently deployed server are unaffected.

CREATE TYPE "LocationMatch" AS ENUM ('MATCHED', 'MISMATCH', 'UNCHECKABLE');

ALTER TABLE "SiteAttendance" ADD COLUMN "checkInLocationMatch" "LocationMatch";
ALTER TABLE "SiteAttendance" ADD COLUMN "checkInLocationDistanceMeters" INTEGER;
ALTER TABLE "SiteAttendance" ADD COLUMN "checkOutLocationMatch" "LocationMatch";
ALTER TABLE "SiteAttendance" ADD COLUMN "checkOutLocationDistanceMeters" INTEGER;
