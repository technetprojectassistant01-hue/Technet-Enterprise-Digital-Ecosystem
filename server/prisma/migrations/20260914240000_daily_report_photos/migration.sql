-- CreateTable
CREATE TABLE "DailyWorkReportPhoto" (
    "id" TEXT NOT NULL,
    "dailyWorkReportId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyWorkReportPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyWorkReportPhoto_dailyWorkReportId_idx" ON "DailyWorkReportPhoto"("dailyWorkReportId");

-- AddForeignKey
ALTER TABLE "DailyWorkReportPhoto" ADD CONSTRAINT "DailyWorkReportPhoto_dailyWorkReportId_fkey" FOREIGN KEY ("dailyWorkReportId") REFERENCES "DailyWorkReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
