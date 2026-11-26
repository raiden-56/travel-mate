import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, resetSchema } from "./auth/schemas";
import { tripFormSchema } from "./trips/schemas";

describe("auth schemas", () => {
  it("requires a letter and a number in passwords", () => {
    const base = { displayName: "Asha", email: "asha@example.com" };
    expect(registerSchema.safeParse({ ...base, password: "abcdefgh" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "12345678" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "travel2026" }).success).toBe(true);
  });

  it("validates email on login", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });

  it("requires matching passwords on reset", () => {
    const r = resetSchema.safeParse({ password: "travel2026", confirm: "travel2025" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["confirm"]);
  });
});

describe("trip form schema", () => {
  const valid = { name: "Gokarna weekend", destinationName: "Gokarna", dayCount: 3, travelers: 4 };

  it("accepts a minimal trip", () => {
    expect(tripFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects end before start", () => {
    const r = tripFormSchema.safeParse({ ...valid, startDate: "2026-12-10", endDate: "2026-12-08" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === "endDate")).toBe(true);
  });

  it("rejects trips longer than 60 days", () => {
    expect(tripFormSchema.safeParse({ ...valid, startDate: "2026-01-01", endDate: "2026-03-15" }).success).toBe(false);
  });

  it("rejects malformed budgets but allows blank", () => {
    expect(tripFormSchema.safeParse({ ...valid, budgetAmount: "20,000" }).success).toBe(false);
    expect(tripFormSchema.safeParse({ ...valid, budgetAmount: "" }).success).toBe(true);
    expect(tripFormSchema.safeParse({ ...valid, budgetAmount: "20000.50" }).success).toBe(true);
  });

  it("coerces numeric inputs from strings", () => {
    const r = tripFormSchema.safeParse({ ...valid, dayCount: "5", travelers: "2" });
    expect(r.success && r.data.dayCount).toBe(5);
  });
});
