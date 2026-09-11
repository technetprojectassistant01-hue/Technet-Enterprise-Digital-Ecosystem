-- The user's UI language ("en" / "fr" / "mfe"), so their choice follows them across devices.
-- Nullable: null means "never chosen", and the first choice made on the sign-in page is saved
-- here on login. Validated in the route, not an enum, so a new language needs no migration.

ALTER TABLE "User" ADD COLUMN "language" TEXT;
