import { describe, expect, it } from "vitest";
import { formatMoney, fromMinor, isMoney, percentOf, subtractMoney, sumMoney, toMinor } from "./money";

describe("money", () => {
  it("parses decimal strings into minor units without float error", () => {
    expect(toMinor("0.1")).toBe(10n);
    expect(toMinor("0.20")).toBe(20n);
    expect(toMinor("12500")).toBe(1_250_000n);
    expect(toMinor("-3.5")).toBe(-350n);
    expect(toMinor(null)).toBe(0n);
  });

  it("sums exactly where floats would drift", () => {
    // 0.1 + 0.2 !== 0.3 in IEEE-754
    expect(sumMoney(["0.10", "0.20"])).toBe("0.30");
    expect(sumMoney(Array.from({ length: 10 }, () => "0.10"))).toBe("1.00");
    expect(sumMoney(["19999.99", "0.01", null])).toBe("20000.00");
  });

  it("subtracts and formats negatives", () => {
    expect(subtractMoney("100.00", "250.50")).toBe("-150.50");
    expect(fromMinor(-5n)).toBe("-0.05");
  });

  it("rejects malformed amounts", () => {
    expect(isMoney("12.345")).toBe(false);
    expect(isMoney("1e3")).toBe(false);
    expect(isMoney("1,000")).toBe(false);
    expect(() => toMinor("abc")).toThrow();
  });

  it("computes integer percentages for progress bars", () => {
    expect(percentOf("50", "200")).toBe(25);
    expect(percentOf("300", "200")).toBe(150);
    expect(percentOf("10", null)).toBe(0);
  });

  it("formats INR in the Indian numbering system", () => {
    expect(formatMoney("1250000", "INR", { noDecimals: true })).toBe("₹12,50,000");
    expect(formatMoney(null)).toBe("—");
  });
});
