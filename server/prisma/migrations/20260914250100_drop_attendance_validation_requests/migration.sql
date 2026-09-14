-- Employees no longer request attendance validation; HR validates each month instead. Remove the
-- request rows (pending or rejected) created while the request flow existed. Validations stay.
DELETE FROM "AttendanceValidation" WHERE "status" <> 'VALIDATED';
