export function formatAssetNumber(sequenceNumber: number): string {
  return `AST-${String(sequenceNumber).padStart(6, "0")}`;
}

export function formatContractNumber(sequenceNumber: number): string {
  return `MC-${String(sequenceNumber).padStart(6, "0")}`;
}

export function formatRequestNumber(sequenceNumber: number): string {
  return `MR-${String(sequenceNumber).padStart(6, "0")}`;
}
