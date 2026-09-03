import { prisma } from "./prisma";

function datePart(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function quotationNumberPrefix(now: Date): string {
  return `Q${datePart(now)}-`;
}

/**
 * The next counter for a day, derived from the highest number actually issued that day rather
 * than from how many rows currently exist. Counting rows breaks permanently as soon as one
 * quotation is deleted: with Q-01/02/03 on file and Q-02 deleted, the count is 2, so the next
 * create asks for Q-03 - which already exists. The retry loop can't help, because a retry
 * recounts and produces the same number again, so every create for the rest of that day fails.
 *
 * Reading the max instead means a deleted number is simply never reused, and the retry loop
 * still does its real job: two near-simultaneous creates both see max N, one wins N+1, and the
 * loser's retry now sees N+1 and takes N+2.
 */
export function nextQuotationSuffix(existingNumbers: string[], prefix: string): number {
  let highest = 0;
  for (const number of existingNumbers) {
    if (!number.startsWith(prefix)) continue;
    const suffix = Number.parseInt(number.slice(prefix.length), 10);
    if (Number.isFinite(suffix) && suffix > highest) highest = suffix;
  }
  return highest + 1;
}

/** Q<YYYYMMDD>-<counter, resets each day> - e.g. Q20260825-01, Q20260825-02. */
export async function generateQuotationNumber(): Promise<string> {
  const prefix = quotationNumberPrefix(new Date());
  const issuedToday = await prisma.quotation.findMany({
    where: { quotationNumber: { startsWith: prefix } },
    select: { quotationNumber: true },
  });
  const next = nextQuotationSuffix(
    issuedToday.map((q) => q.quotationNumber),
    prefix,
  );
  return `${prefix}${String(next).padStart(2, "0")}`;
}
