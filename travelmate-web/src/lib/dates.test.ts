import { describe, expect, it } from "vitest";
import { addDays, daysBetweenInclusive, daysUntil, formatDuration, formatTime, toIsoDate, parseLocalDate } from "./dates";

describe("dates", () => {
  it("treats YYYY-MM-DD as a local calendar date", () => {
    expect(toIsoDate(parseLocalDate("2026-12-31"))).toBe("2026-12-31");
  });

  it("counts trip days inclusively across month boundaries", () => {
    expect(daysBetweenInclusive("2026-12-30", "2027-01-02")).toBe(4);
    expect(daysBetweenInclusive("2026-03-01", "2026-03-01")).toBe(1);
  });

  it("adds days", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });

  it("computes countdowns relative to today", () => {
    const today = new Date(2026, 10, 24, 18, 30);
    expect(daysUntil("2026-11-24", today)).toBe(0);
    expect(daysUntil("2026-11-27", today)).toBe(3);
    expect(daysUntil("2026-11-20", today)).toBe(-4);
  });

  it("formats times and durations", () => {
    expect(formatTime("07:00")).toBe("7am");
    expect(formatTime("13:45")).toBe("1:45pm");
    expect(formatTime("00:30")).toBe("12:30am");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(150)).toBe("2 h 30 min");
  });
});
