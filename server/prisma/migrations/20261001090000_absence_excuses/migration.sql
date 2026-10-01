CREATE TABLE "AbsenceExcuse" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "excusedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsenceExcuse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AbsenceExcuse_employeeId_date_key" ON "AbsenceExcuse"("employeeId", "date");

ALTER TABLE "AbsenceExcuse" ADD CONSTRAINT "AbsenceExcuse_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AbsenceExcuse" ADD CONSTRAINT "AbsenceExcuse_excusedById_fkey" FOREIGN KEY ("excusedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
