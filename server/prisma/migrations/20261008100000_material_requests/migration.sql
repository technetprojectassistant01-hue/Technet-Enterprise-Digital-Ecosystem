-- Material requests (consumables, requested line by line) beside tool requests.
CREATE TYPE "MaterialRequestStatus" AS ENUM ('PENDING', 'ISSUED', 'REJECTED');

ALTER TYPE "NotificationType" ADD VALUE 'MATERIAL_REQUEST_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'MATERIAL_REQUEST_ISSUED';
ALTER TYPE "NotificationType" ADD VALUE 'MATERIAL_REQUEST_REJECTED';

CREATE TABLE "MaterialRequest" (
    "id" TEXT NOT NULL,
    "sequenceNumber" SERIAL NOT NULL,
    "employeeId" TEXT NOT NULL,
    "purpose" TEXT,
    "neededBy" TIMESTAMP(3),
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "MaterialRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaterialRequest_sequenceNumber_key" ON "MaterialRequest"("sequenceNumber");
CREATE INDEX "MaterialRequest_employeeId_idx" ON "MaterialRequest"("employeeId");
CREATE INDEX "MaterialRequest_status_idx" ON "MaterialRequest"("status");
CREATE INDEX "MaterialRequestItem_requestId_idx" ON "MaterialRequestItem"("requestId");

ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
