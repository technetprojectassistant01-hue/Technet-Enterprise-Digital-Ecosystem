import { describe, expect, it } from "vitest";
import { redact, SENSITIVE_FIELDS } from "./employees";

function sampleEmployee() {
  return {
    id: "emp-1",
    employeeCode: "E001",
    firstName: "Jane",
    lastName: "Doe",
    position: "Technician",
    department: "Field Service",
    nationalId: "S1234567",
    dateOfBirth: new Date("1990-01-01"),
    gender: "FEMALE",
    address: "123 Main St",
    emergencyContactName: "John Doe",
    emergencyContactPhone: "555-1234",
    emergencyContactRelation: "Spouse",
    basicSalary: 50000,
    bankName: "Test Bank",
    bankAccountNumber: "0001112223",
    exitReason: null,
    notes: "confidential note",
  };
}

describe("redact", () => {
  it("nulls out every sensitive field", () => {
    const redacted = redact(sampleEmployee());
    for (const field of SENSITIVE_FIELDS) {
      expect(redacted[field as keyof typeof redacted]).toBeNull();
    }
  });

  it("leaves non-sensitive fields untouched", () => {
    const redacted = redact(sampleEmployee());
    expect(redacted.id).toBe("emp-1");
    expect(redacted.employeeCode).toBe("E001");
    expect(redacted.firstName).toBe("Jane");
    expect(redacted.lastName).toBe("Doe");
    expect(redacted.position).toBe("Technician");
    expect(redacted.department).toBe("Field Service");
  });

  it("does not mutate the original object", () => {
    const original = sampleEmployee();
    const snapshot = { ...original };
    redact(original);
    expect(original).toEqual(snapshot);
  });
});
