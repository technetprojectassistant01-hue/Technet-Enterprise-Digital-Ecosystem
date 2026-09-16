import { prisma } from "./prisma";

/**
 * Work order numbers were typed by hand and are plain sequential numbers (100, 101, ...). Like
 * employee codes (employeeCode.ts) the next one comes from the highest *numeric* number on file
 * rather than a row count, so a deleted work order's number is never reissued. Numbers that are
 * not plain digits are ignored rather than breaking the scan.
 *
 * The first ever number is 100, not 1, because that is where this company's own numbering starts.
 */
export const FIRST_WORK_ORDER_NUMBER = 100;

export function nextWorkOrderNumber(existingNumbers: string[]): string {
  let highest = 0;
  for (const number of existingNumbers) {
    if (!/^\d+$/.test(number)) continue;
    const n = Number.parseInt(number, 10);
    if (n > highest) highest = n;
  }
  return String(Math.max(highest + 1, FIRST_WORK_ORDER_NUMBER));
}

export async function generateWorkOrderNumber(): Promise<string> {
  const workOrders = await prisma.workOrder.findMany({ select: { workOrderNumber: true } });
  return nextWorkOrderNumber(workOrders.map((w) => w.workOrderNumber));
}
