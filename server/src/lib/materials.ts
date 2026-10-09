/**
 * The Technet Store materials register (2026-10-09): consumables kept by quantity, separate from ERP
 * Inventory (the user's choice). Pure helpers - routes/materials.ts and routes/materialRequests.ts
 * do the database work. Tested in materials.test.ts.
 */

const MAX_QUANTITY = 1_000_000;

export function formatMaterialNumber(sequenceNumber: number): string {
  return `MT-${String(sequenceNumber).padStart(4, "0")}`;
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * A quantity typed in a form or sent as a number: finite, at most 2 decimals, within range, and
 * above zero unless `allowZero`. Returns the number, or null when it isn't acceptable.
 */
export function parseQuantity(value: unknown, { allowZero = false } = {}): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n) || n > MAX_QUANTITY) return null;
  if (allowZero ? n < 0 : n <= 0) return null;
  if (Math.abs(Math.round(n * 100) - n * 100) > 1e-6) return null;
  return Math.round(n * 100) / 100;
}

export interface MaterialFields {
  name: string;
  reference: string | null;
  category: string | null;
  unit: string;
  minStock: number;
  location: string | null;
  notes: string | null;
}

/**
 * The fields a storekeeper fills in for a material. On create the opening stock comes too
 * (`withQuantity`), defaulting to 0; on edit the stock is never set here - it only moves through
 * Add stock / Correct count / issuing, so every change leaves a MaterialMovement.
 */
export function parseMaterialFields(
  body: Record<string, unknown>,
  { withQuantity = false } = {},
): { data: MaterialFields & { quantity?: number } } | { error: string } {
  const name = text(body.name);
  if (!name) return { error: "Give the material a name" };
  const minStock = body.minStock === undefined || body.minStock === null || body.minStock === "" ? 0 : parseQuantity(body.minStock, { allowZero: true });
  if (minStock === null) return { error: "Minimum stock must be a number of zero or more (up to 2 decimals)" };
  const data: MaterialFields & { quantity?: number } = {
    name,
    reference: text(body.reference),
    category: text(body.category),
    unit: text(body.unit) ?? "unit",
    minStock,
    location: text(body.location),
    notes: text(body.notes),
  };
  if (withQuantity) {
    const quantity = body.quantity === undefined || body.quantity === null || body.quantity === "" ? 0 : parseQuantity(body.quantity, { allowZero: true });
    if (quantity === null) return { error: "Opening stock must be a number of zero or more (up to 2 decimals)" };
    data.quantity = quantity;
  }
  return { data };
}

/**
 * A stock change from the register: "IN" adds a positive amount (a delivery), "ADJUST" sets the
 * counted stock (zero allowed). Returns what to apply, or an error.
 */
export function parseStockChange(
  body: Record<string, unknown>,
): { data: { type: "IN"; quantity: number; reason: string | null } | { type: "ADJUST"; count: number; reason: string | null } } | { error: string } {
  const reason = text(body.reason);
  if (body.type === "IN") {
    const quantity = parseQuantity(body.quantity);
    if (quantity === null) return { error: "Enter how much stock to add (above zero, up to 2 decimals)" };
    return { data: { type: "IN", quantity, reason } };
  }
  if (body.type === "ADJUST") {
    const count = parseQuantity(body.quantity, { allowZero: true });
    if (count === null) return { error: "Enter the counted stock (zero or more, up to 2 decimals)" };
    return { data: { type: "ADJUST", count, reason } };
  }
  return { error: "Unknown stock change" };
}

export interface IssueLine {
  itemId: string;
  /** null = issued without a stock match. */
  materialId: string | null;
  quantity: number;
}

/**
 * The store's issue form: one entry per request line, optionally matched to a stock material, with
 * the quantity handed over (defaults to what was asked for). Every request line must be covered
 * exactly once. `requested` maps each line id to its requested quantity.
 */
export function parseIssueLines(raw: unknown, requested: Map<string, number>): { lines: IssueLine[] } | { error: string } {
  const entries = Array.isArray(raw) ? raw : [];
  const byItem = new Map<string, IssueLine>();
  for (const e of entries) {
    const entry = (e ?? {}) as Record<string, unknown>;
    const itemId = typeof entry.itemId === "string" ? entry.itemId : null;
    if (!itemId || !requested.has(itemId)) return { error: "The issue form doesn't match this request - refresh and try again" };
    if (byItem.has(itemId)) return { error: "A request line appears twice in the issue form" };
    const materialId = typeof entry.materialId === "string" && entry.materialId ? entry.materialId : null;
    const quantity =
      entry.quantity === undefined || entry.quantity === null || entry.quantity === "" ? requested.get(itemId)! : parseQuantity(entry.quantity);
    if (quantity === null) return { error: "Each issued quantity must be above zero (up to 2 decimals)" };
    byItem.set(itemId, { itemId, materialId, quantity });
  }
  // Lines the form didn't mention are issued as asked, without a stock match.
  for (const [itemId, quantity] of requested) {
    if (!byItem.has(itemId)) byItem.set(itemId, { itemId, materialId: null, quantity });
  }
  return { lines: [...byItem.values()] };
}

/** Low stock = at or below the minimum, when a minimum is set. */
export function isLowStock(quantity: number, minStock: number): boolean {
  return minStock > 0 && quantity <= minStock;
}
