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
