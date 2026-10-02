import { prisma } from "./prisma";
import { dayToDate, MAURITIUS_OFFSET_MINUTES, mauritiusDay } from "./overtime";
import { cancelPendingAudits } from "./attendanceAudit";
import { notifyEmployee } from "./notifications";
import { evaluateVisit } from "./anomalies";

/**
 * Automatic check-out (management, 2026-10-02). Technicians check in around 08:00 and out around
 * 17:00, but some forget to check out and only do it the next day - which booked 20+ hours and
 * showed as huge "overtime". So once midnight passes, a shift still open is checked out at closing
 * time on the day it started: **17:00, or 13:00 on a Saturday** (so a forgotten Saturday check-out
 * can't create overtime either - overtime only starts at 17:30 / 13:30).
 *
 * If the check-in itself was after closing time (an evening call-out), the check-out can't be
 * earlier than it, so the shift closes at its check-in time (0 hours) for a manager to correct.
 *
 * Runs lazily, not at exactly 00:00: the cron-job.org poller only calls between 07:00 and 18:59, so
 * forgotten shifts are also closed the moment that technician next checks in or opens the app
 * (closeForgottenSessions(employeeId)). The outcome is identical - the time recorded is always the
 * previous day's closing time - and nobody is stuck on "already checked in" in the morning.
 */

/** Closing time on the Mauritius day of `checkInAt`, never before the check-in itself. */
export function autoCheckoutTime(checkInAt: Date): Date {
  const day = mauritiusDay(checkInAt);
  const weekday = dayToDate(day).getUTCDay();
  const closingMinutes = weekday === 6 ? 13 * 60 : 17 * 60;
  const closing = new Date(dayToDate(day).getTime() + (closingMinutes - MAURITIUS_OFFSET_MINUTES) * 60_000);
  return closing.getTime() > checkInAt.getTime() ? closing : checkInAt;
}

/** "HH:MM" Mauritius wall-clock of an instant - what the auto check-out records as the typed time. */
export function mauritiusClock(at: Date): string {
  return new Date(at.getTime() + MAURITIUS_OFFSET_MINUTES * 60_000).toISOString().slice(11, 16);
}

/** Midnight at the start of today in Mauritius, as an instant. */
function startOfMauritiusToday(now = new Date()): Date {
  return new Date(dayToDate(mauritiusDay(now)).getTime() - MAURITIUS_OFFSET_MINUTES * 60_000);
}

/**
 * Checks out every shift that is still open from an earlier Mauritius day - all of them, or one
 * employee's. Returns how many were closed. Never throws (a failure here must not break the
 * check-in or page that triggered it); it simply runs again next time.
 */
export async function closeForgottenSessions(employeeId?: string): Promise<number> {
  try {
    const stale = await prisma.siteAttendance.findMany({
      where: { checkOutAt: null, checkInAt: { lt: startOfMauritiusToday() }, ...(employeeId ? { employeeId } : {}) },
      select: { id: true, employeeId: true, checkInAt: true },
    });
    let closed = 0;
    for (const v of stale) {
      const at = autoCheckoutTime(v.checkInAt);
      // Conditional on still being open, so two triggers at once can't both close it.
      const { count } = await prisma.siteAttendance.updateMany({
        where: { id: v.id, checkOutAt: null },
        data: {
          checkOutAt: at,
          checkOutDeclaredTime: mauritiusClock(at),
          checkOutAutomatic: true,
          checkOutNote: "Checked out automatically - no check-out recorded",
        },
      });
      if (!count) continue;
      closed += 1;
      await cancelPendingAudits(v.id);
      void evaluateVisit(v.id);
      await notifyEmployee(
        v.employeeId,
        "AUTO_CHECKED_OUT",
        `You were checked out automatically at ${mauritiusClock(at)} on ${mauritiusDay(v.checkInAt)}`,
        {
          message: "You didn't check out that day. If you finished at a different time, ask your manager to correct it.",
          link: "/dashboard",
        },
      );
    }
    return closed;
  } catch (err) {
    console.error("closeForgottenSessions failed:", err);
    return 0;
  }
}
