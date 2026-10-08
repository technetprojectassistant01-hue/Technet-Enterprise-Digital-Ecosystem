import { parseDateOnly } from "./leaveRequests";

/** Material requests (2026-10-08): consumables asked for line by line - see MaterialRequest in schema.prisma. */

export const MAX_MATERIAL_LINES = 50;
const MAX_QUANTITY = 1_000_000;

export function formatMaterialRequestNumber(sequenceNumber: number): string {
  return `MR-${String(sequenceNumber).padStart(4, "0")}`;
}

export interface MaterialLine {
  description: string;
  reference: string | null;
  quantity: number;
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * Validates what a requester fills in: at least one line, each with a description and a quantity
 * above zero (up to 2 decimals - "1.5" litres is fine); reference is optional. Blank lines left at
 * the bottom of the form are dropped rather than rejected. Returns the data to save, or an error.
 */
export function parseMaterialRequest(body: Record<string, unknown>):
  | { data: { purpose: string | null; neededBy: Date | null; items: MaterialLine[] } }
  | { error: string } {
  const rawItems = Array.isArray(body.items) ? body.items : null;
  if (!rawItems) return { error: "Add at least one material" };

  const items: MaterialLine[] = [];
  for (const [i, raw] of rawItems.entries()) {
    const line = (raw ?? {}) as Record<string, unknown>;
    const description = text(line.description);
    const reference = text(line.reference);
    const quantityRaw = line.quantity;
    const blank = !description && !reference && (quantityRaw === undefined || quantityRaw === null || quantityRaw === "");
    if (blank) continue;
    if (!description) return { error: `Line ${i + 1}: describe the material` };
    const quantity = typeof quantityRaw === "number" ? quantityRaw : typeof quantityRaw === "string" ? Number(quantityRaw.trim()) : NaN;
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: `Line ${i + 1}: enter a quantity above zero` };
    if (quantity > MAX_QUANTITY) return { error: `Line ${i + 1}: quantity is too large` };
    if (Math.abs(Math.round(quantity * 100) - quantity * 100) > 1e-6) return { error: `Line ${i + 1}: use at most 2 decimals for the quantity` };
    items.push({ description, reference, quantity });
  }
  if (items.length === 0) return { error: "Add at least one material" };
  if (items.length > MAX_MATERIAL_LINES) return { error: `A request can have at most ${MAX_MATERIAL_LINES} lines` };

  let neededBy: Date | null = null;
  if (body.neededBy !== undefined && body.neededBy !== null && body.neededBy !== "") {
    neededBy = parseDateOnly(body.neededBy);
    if (!neededBy) return { error: "Invalid needed-by date" };
  }
  return { data: { purpose: text(body.purpose), neededBy, items } };
}

/** One line per material, for notifications: "2 x Silicone glue (SIL-300)". */
export function describeMaterialLines(items: { description: string; reference: string | null; quantity: unknown }[]): string {
  return items.map((l) => `${Number(l.quantity)} x ${l.description}${l.reference ? ` (${l.reference})` : ""}`).join(", ");
}
