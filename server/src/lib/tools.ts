export const TOOL_STATUSES = ["AVAILABLE", "CHECKED_OUT", "UNDER_REPAIR", "RETIRED"] as const;
export type ToolStatusValue = (typeof TOOL_STATUSES)[number];

/** Statuses a manager may set by hand. CHECKED_OUT only ever comes from issuing a tool. */
export const MANUAL_TOOL_STATUSES = ["AVAILABLE", "UNDER_REPAIR", "RETIRED"] as const;

export const TOOL_CONDITIONS = ["GOOD", "FAIR", "DAMAGED"] as const;
export type ToolConditionValue = (typeof TOOL_CONDITIONS)[number];

export function formatToolNumber(sequenceNumber: number): string {
  return `TL-${String(sequenceNumber).padStart(4, "0")}`;
}

export function formatToolRequestNumber(sequenceNumber: number): string {
  return `TR-${String(sequenceNumber).padStart(4, "0")}`;
}

/** A returned tool goes back on the shelf, unless it came back damaged - then it needs repair first. */
export function statusAfterReturn(condition: ToolConditionValue): ToolStatusValue {
  return condition === "DAMAGED" ? "UNDER_REPAIR" : "AVAILABLE";
}

/**
 * Parses the list of tools picked when issuing a request: a non-empty array of distinct string
 * ids. Returns null when the input isn't usable.
 */
export function parseToolIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((id) => typeof id === "string" && id.length > 0)) return null;
  return [...new Set(value as string[])];
}
