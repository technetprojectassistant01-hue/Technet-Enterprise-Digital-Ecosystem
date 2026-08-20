-- CreateTable
CREATE TABLE "InterventionReportUnit" (
    "id" TEXT NOT NULL,
    "interventionReportId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "action" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InterventionReportUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterventionReportUnit_interventionReportId_idx" ON "InterventionReportUnit"("interventionReportId");

-- AddForeignKey
ALTER TABLE "InterventionReportUnit" ADD CONSTRAINT "InterventionReportUnit_interventionReportId_fkey" FOREIGN KEY ("interventionReportId") REFERENCES "InterventionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
