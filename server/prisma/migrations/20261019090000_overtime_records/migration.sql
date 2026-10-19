-- Manual overtime records (AiFace "Overtime Records"), stored on the day's OvertimeDecision.
CREATE TYPE "OvertimeType" AS ENUM ('NORMAL', 'REST_DAY', 'PUBLIC_HOLIDAY');

ALTER TABLE "OvertimeDecision" ADD COLUMN "manual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OvertimeDecision" ADD COLUMN "type" "OvertimeType";
ALTER TABLE "OvertimeDecision" ADD COLUMN "startTime" TEXT;
ALTER TABLE "OvertimeDecision" ADD COLUMN "endTime" TEXT;
