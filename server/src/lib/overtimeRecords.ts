import type { OvertimeDay } from "./overtime";

/**
 * Manual overtime records (2026-10-19), the "Overtime Records" of the office AiFace attendance
 * software: HR or an admin types the overtime in - staff, type, start, end, reason - and is saved as
 * the approver. Stored on the day's OvertimeDecision (one per employee per day, `manual = true`,
 * status APPROVED), so a record **replaces** that day's calculated overtime (the user's choice) and
 * flows into payroll, the reports and My Attendance like any approved day.
 */

export const OVERTIME_TYPES = ["NORMAL", "REST_DAY", "PUBLIC_HOLIDAY"] as const;
export type OvertimeType = (typeof OVERTIME_TYPES)[number];

/** Labels as the reports print them. */
export const OVERTIME_TYPE_LABELS: Record<OvertimeType, string> = {
  NORMAL: "Normal",
  REST_DAY: "Rest day",
  PUBLIC_HOLIDAY: "Public holiday",
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes from start to end; an end at or before the start runs past midnight into the next day. */
export function recordMinutes(startTime: string, endTime: string): number {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  return end > start ? end - start : end + 1440 - start;
}

export interface OvertimeRecordInput {
  employeeId: string;
  /** Mauritius calendar day, "YYYY-MM-DD". */
  date: string;
  type: OvertimeType;
  startTime: string;
  endTime: string;
  minutes: number;
  reason: string;
}

/** Validates a record from the request body. `today` (Mauritius) - a record can't be for a future day. */
export function parseOvertimeRecord(body: unknown, today: string): { value: OvertimeRecordInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const employeeId = typeof b.employeeId === "string" ? b.employeeId.trim() : "";
  if (!employeeId) return { error: "Choose the employee" };

  const date = typeof b.date === "string" ? b.date : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
    return { error: "Date must be YYYY-MM-DD" };
  }
  if (date > today) return { error: "Overtime can't be recorded for a day that hasn't happened yet" };

  const type = b.type;
  if (typeof type !== "string" || !(OVERTIME_TYPES as readonly string[]).includes(type)) {
    return { error: "Type must be Normal, Rest day or Public holiday" };
  }

  const startTime = typeof b.startTime === "string" ? b.startTime.trim() : "";
  const endTime = typeof b.endTime === "string" ? b.endTime.trim() : "";
  if (!TIME.test(startTime) || !TIME.test(endTime)) return { error: "Start and end must be times (HH:MM)" };
  if (startTime === endTime) return { error: "End must be different from start" };

  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (!reason) return { error: "Give a reason for the overtime" };
  if (reason.length > 500) return { error: "Reason must be 500 characters or fewer" };

  return {
    value: { employeeId, date, type: type as OvertimeType, startTime, endTime, minutes: recordMinutes(startTime, endTime), reason },
  };
}

/**
 * The calculated overtime days with each manual record put in place of that employee-day - the
 * record replaces a calculated figure, or adds a day the app had nothing for.
 */
export function withManualRecords(
  days: OvertimeDay[],
  records: { employeeId: string; date: string; minutes: number; startTime: string | null; endTime: string | null }[],
): OvertimeDay[] {
  const byKey = new Map(records.map((r) => [`${r.employeeId}|${r.date}`, r]));
  const result = days.map((d) => {
    const r = byKey.get(`${d.employeeId}|${d.date}`);
    if (!r) return d;
    byKey.delete(`${d.employeeId}|${d.date}`);
    return { ...d, minutes: r.minutes, firstIn: r.startTime ?? d.firstIn, lastOut: r.endTime ?? d.lastOut };
  });
  for (const r of byKey.values()) {
    result.push({ employeeId: r.employeeId, date: r.date, minutes: r.minutes, firstIn: r.startTime ?? "", lastOut: r.endTime ?? "" });
  }
  return result.sort((a, b) => (a.date === b.date ? a.employeeId.localeCompare(b.employeeId) : b.date.localeCompare(a.date)));
}
