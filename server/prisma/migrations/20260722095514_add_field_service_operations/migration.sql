-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('INSTALLATION', 'START_UP_COMMISSIONING', 'OUTDOOR_REPAIR', 'WORKSHOP_REPAIR', 'SERVICING', 'MAINTENANCE_CONTRACT', 'SURVEY', 'OTHERS');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('YES', 'NO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "jobCategory" "JobCategory" NOT NULL,
    "description" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderTechnician" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "WorkOrderTechnician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWorkReport" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "hours" DECIMAL(5,2),
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyWorkReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWorkReportTechnician" (
    "id" TEXT NOT NULL,
    "dailyWorkReportId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "DailyWorkReportTechnician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWorkReportWorkOrder" (
    "id" TEXT NOT NULL,
    "dailyWorkReportId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,

    CONSTRAINT "DailyWorkReportWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionReport" (
    "id" TEXT NOT NULL,
    "interventionNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "jobCategory" "JobCategory" NOT NULL,
    "equipment" TEXT,
    "make" TEXT,
    "model" TEXT,
    "serialNo" TEXT,
    "dateInstalled" TIMESTAMP(3),
    "natureOfIntervention" TEXT NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "workCompleted" BOOLEAN NOT NULL DEFAULT true,
    "incompleteDetails" TEXT,
    "timeIn" TEXT,
    "timeOut" TEXT,
    "warrantyStatus" "WarrantyStatus",
    "technicianReport" TEXT,
    "comments" TEXT,
    "signatureData" BYTEA,
    "signedByName" TEXT,
    "signedAt" TIMESTAMP(3),
    "attachmentData" BYTEA,
    "attachmentFileName" TEXT,
    "attachmentMimeType" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterventionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionReportTechnician" (
    "id" TEXT NOT NULL,
    "interventionReportId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "InterventionReportTechnician_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_workOrderNumber_key" ON "WorkOrder"("workOrderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderTechnician_workOrderId_employeeId_key" ON "WorkOrderTechnician"("workOrderId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWorkReportTechnician_dailyWorkReportId_employeeId_key" ON "DailyWorkReportTechnician"("dailyWorkReportId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWorkReportWorkOrder_dailyWorkReportId_workOrderId_key" ON "DailyWorkReportWorkOrder"("dailyWorkReportId", "workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionReport_interventionNumber_key" ON "InterventionReport"("interventionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionReportTechnician_interventionReportId_employeeI_key" ON "InterventionReportTechnician"("interventionReportId", "employeeId");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderTechnician" ADD CONSTRAINT "WorkOrderTechnician_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderTechnician" ADD CONSTRAINT "WorkOrderTechnician_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkReport" ADD CONSTRAINT "DailyWorkReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkReport" ADD CONSTRAINT "DailyWorkReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkReportTechnician" ADD CONSTRAINT "DailyWorkReportTechnician_dailyWorkReportId_fkey" FOREIGN KEY ("dailyWorkReportId") REFERENCES "DailyWorkReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkReportTechnician" ADD CONSTRAINT "DailyWorkReportTechnician_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkReportWorkOrder" ADD CONSTRAINT "DailyWorkReportWorkOrder_dailyWorkReportId_fkey" FOREIGN KEY ("dailyWorkReportId") REFERENCES "DailyWorkReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkReportWorkOrder" ADD CONSTRAINT "DailyWorkReportWorkOrder_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionReport" ADD CONSTRAINT "InterventionReport_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionReport" ADD CONSTRAINT "InterventionReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionReport" ADD CONSTRAINT "InterventionReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionReportTechnician" ADD CONSTRAINT "InterventionReportTechnician_interventionReportId_fkey" FOREIGN KEY ("interventionReportId") REFERENCES "InterventionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionReportTechnician" ADD CONSTRAINT "InterventionReportTechnician_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

