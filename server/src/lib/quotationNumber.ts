import { prisma } from "./prisma";

function datePart(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Q<YYYYMMDD>-<counter, resets each day> - e.g. Q20260825-01, Q20260825-02. */
export async function generateQuotationNumber(): Promise<string> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const countToday = await prisma.quotation.count({
    where: { createdAt: { gte: startOfDay, lt: endOfDay } },
  });
  return `Q${datePart(now)}-${String(countToday + 1).padStart(2, "0")}`;
}
