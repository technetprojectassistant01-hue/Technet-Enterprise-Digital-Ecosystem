-- CreateEnum
CREATE TYPE "ToolStatus" AS ENUM ('AVAILABLE', 'CHECKED_OUT', 'UNDER_REPAIR', 'RETIRED');

-- CreateEnum
CREATE TYPE "ToolCondition" AS ENUM ('GOOD', 'FAIR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "ToolRequestStatus" AS ENUM ('PENDING', 'ISSUED', 'REJECTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TOOL_REQUEST_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'TOOL_REQUEST_ISSUED';
ALTER TYPE "NotificationType" ADD VALUE 'TOOL_REQUEST_REJECTED';

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "sequenceNumber" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "serialNumber" TEXT,
    "status" "ToolStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "ToolCondition" NOT NULL DEFAULT 'GOOD',
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolRequest" (
    "id" TEXT NOT NULL,
    "sequenceNumber" SERIAL NOT NULL,
    "employeeId" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "purpose" TEXT,
    "neededBy" TIMESTAMP(3),
    "status" "ToolRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolCheckout" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestId" TEXT,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "returnCondition" "ToolCondition",
    "returnNote" TEXT,

    CONSTRAINT "ToolCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tool_sequenceNumber_key" ON "Tool"("sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Tool_serialNumber_key" ON "Tool"("serialNumber");

-- CreateIndex
CREATE INDEX "Tool_status_idx" ON "Tool"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ToolRequest_sequenceNumber_key" ON "ToolRequest"("sequenceNumber");

-- CreateIndex
CREATE INDEX "ToolRequest_employeeId_idx" ON "ToolRequest"("employeeId");

-- CreateIndex
CREATE INDEX "ToolRequest_status_idx" ON "ToolRequest"("status");

-- CreateIndex
CREATE INDEX "ToolCheckout_toolId_returnedAt_idx" ON "ToolCheckout"("toolId", "returnedAt");

-- CreateIndex
CREATE INDEX "ToolCheckout_employeeId_returnedAt_idx" ON "ToolCheckout"("employeeId", "returnedAt");

-- AddForeignKey
ALTER TABLE "ToolRequest" ADD CONSTRAINT "ToolRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolRequest" ADD CONSTRAINT "ToolRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCheckout" ADD CONSTRAINT "ToolCheckout_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCheckout" ADD CONSTRAINT "ToolCheckout_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCheckout" ADD CONSTRAINT "ToolCheckout_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ToolRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCheckout" ADD CONSTRAINT "ToolCheckout_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCheckout" ADD CONSTRAINT "ToolCheckout_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

