-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PERMANENT', 'FIXED_TERM', 'CASUAL', 'INTERN', 'CONSULTANT');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "basicSalary" DECIMAL(12,2),
ADD COLUMN     "contractEndDate" TIMESTAMP(3),
ADD COLUMN     "contractType" "ContractType",
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRelation" TEXT,
ADD COLUMN     "exitDate" TIMESTAMP(3),
ADD COLUMN     "exitReason" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "jobGrade" TEXT,
ADD COLUMN     "nationalId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "probationEndDate" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_nationalId_key" ON "Employee"("nationalId");
