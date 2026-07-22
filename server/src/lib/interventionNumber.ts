export function formatInterventionNumber(sequenceNumber: number): string {
  return `INT-${String(sequenceNumber).padStart(6, "0")}`;
}
