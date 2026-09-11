import { prisma } from "./prisma";

/**
 * Employee codes today are plain zero-padded sequential numbers (001, 002, 003, ...), typed by
 * hand by HR. Auto-generating picks up from the highest *numeric* code on file rather than
 * counting rows, for the same reason as nextQuotationSuffix (quotationNumber.ts): a deleted
 * employee's code must never be reissued, and counting rows breaks the moment one is deleted.
 * Non-numeric codes (test data, or anything imported under a different scheme) are ignored
 * rather than breaking the scan.
 */
export function nextEmployeeCode(existingCodes: string[]): string {
  let highest = 0;
  for (const code of existingCodes) {
    if (!/^\d+$/.test(code)) continue;
    const n = Number.parseInt(code, 10);
    if (n > highest) highest = n;
  }
  return String(highest + 1).padStart(3, "0");
}

export async function generateEmployeeCode(): Promise<string> {
  const employees = await prisma.employee.findMany({ select: { employeeCode: true } });
  return nextEmployeeCode(employees.map((e) => e.employeeCode));
}
