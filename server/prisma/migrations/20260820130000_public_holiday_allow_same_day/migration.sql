-- DropIndex
DROP INDEX "PublicHoliday_date_key";

-- CreateIndex
CREATE INDEX "PublicHoliday_date_idx" ON "PublicHoliday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_date_name_key" ON "PublicHoliday"("date", "name");
