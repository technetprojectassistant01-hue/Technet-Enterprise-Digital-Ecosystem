-- Marks a session a manager closed because the technician forgot to check out.
--
-- Such a row deliberately has no checkOutLat/checkOutLng: nobody observed where the technician
-- was, and writing a position nobody recorded would put a fabricated location into the record
-- this system exists to be trusted on. The flag keeps that distinction visible in reporting
-- instead of letting an administrative close look like a real check-out.

ALTER TABLE "SiteAttendance" ADD COLUMN "checkOutByManager" BOOLEAN NOT NULL DEFAULT false;
