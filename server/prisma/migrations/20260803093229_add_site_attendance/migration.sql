-- CreateTable
CREATE TABLE "SiteAttendance" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkInLat" DECIMAL(9,6) NOT NULL,
    "checkInLng" DECIMAL(9,6) NOT NULL,
    "checkOutAt" TIMESTAMP(3),
    "checkOutLat" DECIMAL(9,6),
    "checkOutLng" DECIMAL(9,6),

    CONSTRAINT "SiteAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteAttendance_workOrderId_idx" ON "SiteAttendance"("workOrderId");

-- CreateIndex
CREATE INDEX "SiteAttendance_employeeId_idx" ON "SiteAttendance"("employeeId");

-- AddForeignKey
ALTER TABLE "SiteAttendance" ADD CONSTRAINT "SiteAttendance_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAttendance" ADD CONSTRAINT "SiteAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
