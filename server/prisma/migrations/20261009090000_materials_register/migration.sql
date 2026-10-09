-- Technet Store materials register, stock movements, and the link from issued request lines.
CREATE TYPE "MaterialMovementType" AS ENUM ('IN', 'OUT', 'ADJUST');

CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "sequenceNumber" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialMovement" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "type" "MaterialMovementType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "requestItemId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialMovement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MaterialRequestItem" ADD COLUMN "materialId" TEXT;
ALTER TABLE "MaterialRequestItem" ADD COLUMN "issuedQuantity" DECIMAL(10,2);

CREATE UNIQUE INDEX "Material_sequenceNumber_key" ON "Material"("sequenceNumber");
CREATE INDEX "Material_name_idx" ON "Material"("name");
CREATE INDEX "MaterialMovement_materialId_idx" ON "MaterialMovement"("materialId");
CREATE INDEX "MaterialRequestItem_materialId_idx" ON "MaterialRequestItem"("materialId");

ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
