-- "Unpaid Leave" becomes "Local Leave" (user request, 2026-09-14). Only the name and code change;
-- whether it is paid, and how many days it allows, stay as they are for HR to set in Leave Types.
UPDATE "LeaveType"
SET "name" = 'Local Leave', "code" = 'LOCAL', "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'UNPAID'
  AND NOT EXISTS (SELECT 1 FROM "LeaveType" WHERE "code" = 'LOCAL' OR "name" = 'Local Leave');
