/** A finished visit, as payroll cares about it: when the server recorded arrival and departure. */
export interface WorkedVisit {
  checkInAt: Date;
  checkOutAt: Date | null;
}

/**
 * Hours on site for a period, from the site attendance visits themselves.
 *
 * Deliberately the recorded timestamps rather than the times the technician typed: this is the
 * same figure "Hours Recorded" shows on the attendance PDF and the Staff Attendance panel, so a
 * payslip and the register HR validated cannot disagree. A visit with no check-out contributes
 * nothing — it has not finished, so there is no duration to pay.
 *
 * A session a manager closed late still carries its full span, which can be large; that is the
 * known forgotten-session problem (CLAUDE.md §7a), corrected by fixing the check-out time rather
 * than by quietly discounting it here.
 */
export function sumWorkedHours(visits: WorkedVisit[]): number {
  const minutes = visits.reduce(
    (sum, v) => (v.checkOutAt ? sum + Math.max(0, (v.checkOutAt.getTime() - v.checkInAt.getTime()) / 60000) : sum),
    0,
  );
  return Number((minutes / 60).toFixed(2));
}

/** Approved overtime minutes for a period, as hours. Only HR-approved days count. */
export function sumApprovedOvertimeHours(decisions: { minutes: number }[]): number {
  const minutes = decisions.reduce((sum, d) => sum + Math.max(0, d.minutes), 0);
  return Number((minutes / 60).toFixed(2));
}

/**
 * Net pay is basic salary minus a pro-rated deduction for unpaid leave days
 * taken in the period. There is no overtime pay rate or tax policy defined
 * anywhere in the SDD or schema, so hours/overtime are informational only
 * and are not folded into this calculation.
 */
export function computeNetPay(basicSalary: number, unpaidLeaveDays: number, daysInMonth: number): { deduction: number; netPay: number } {
  const dailyRate = daysInMonth > 0 ? basicSalary / daysInMonth : 0;
  const deduction = Math.min(basicSalary, dailyRate * unpaidLeaveDays);
  const netPay = basicSalary - deduction;
  return {
    deduction: Number(deduction.toFixed(2)),
    netPay: Number(netPay.toFixed(2)),
  };
}
