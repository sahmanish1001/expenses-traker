import { describe, it, expect } from "vitest";
import { adToBs, bsToAdPure, bsLabel, bsMonthKey, shiftBsMonth, nextBsDueDate } from "./nepaliCalendar.js";

describe("adToBs / bsToAdPure", () => {
  it("converts a known AD date to its correct BS date", () => {
    expect(adToBs("2026-09-07")).toEqual({ year: 2083, month: 5, day: 23 });
  });

  it("round-trips a BS date back to the same AD date", () => {
    const bs = adToBs("2026-09-07");
    expect(bsToAdPure(bs.year, bs.month, bs.day)).toBe("2026-09-07");
  });

  it("returns null for a BS month outside 1-12, instead of guessing", () => {
    expect(bsToAdPure(2083, 13, 1)).toBeNull();
    expect(bsToAdPure(2083, 0, 1)).toBeNull();
  });

  it("lands on the correct BS year across a Baisakh (new year) boundary", () => {
    // Baisakh 1, 2083 is documented as 2026-04-13 in BS_MONTH_STARTS.
    expect(adToBs("2026-04-13")).toEqual({ year: 2083, month: 1, day: 1 });
    // The day before is still the previous BS year's last month.
    const dayBefore = adToBs("2026-04-12");
    expect(dayBefore.year).toBe(2082);
    expect(dayBefore.month).toBe(12);
  });
});

describe("bsLabel", () => {
  it("formats as 'Month day, year'", () => {
    expect(bsLabel("2026-09-07")).toBe("Bhadra 23, 2083");
  });
});

describe("bsMonthKey", () => {
  it("is 'year-month', usable as a grouping key", () => {
    expect(bsMonthKey("2026-09-07")).toBe("2083-5");
  });
});

describe("shiftBsMonth", () => {
  it("advances within the same year", () => {
    expect(shiftBsMonth(2083, 5, 1)).toEqual({ year: 2083, month: 6 });
  });

  it("wraps forward into the next year past Chaitra (month 12)", () => {
    expect(shiftBsMonth(2083, 12, 1)).toEqual({ year: 2084, month: 1 });
  });

  it("wraps backward into the previous year before Baisakh (month 1)", () => {
    expect(shiftBsMonth(2083, 1, -1)).toEqual({ year: 2082, month: 12 });
  });

  it("handles a multi-month jump across a year boundary", () => {
    expect(shiftBsMonth(2083, 11, 3)).toEqual({ year: 2084, month: 2 });
  });
});

// Shared by Recurring bills and Room rent in main.js — the "which cycle
// does this due-day fall in" logic that used to be duplicated inline in
// both places, including a real d.toISOString()-based date-shift bug
// (see the comment on fmtLocalDate() in public/main.js) in one of the two
// copies before this extraction.
describe("nextBsDueDate", () => {
  const today = "2026-09-07"; // BS 2083-5-23 (Bhadra 23)

  it("stays in the current BS month when the due day hasn't happened yet", () => {
    const dueDay = 28; // later in Bhadra than day 23
    const expected = bsToAdPure(2083, 5, dueDay);
    expect(nextBsDueDate(dueDay, today)).toBe(expected);
    expect(nextBsDueDate(dueDay, today) > today).toBe(true);
  });

  it("rolls into next BS month once the due day has already passed", () => {
    const dueDay = 10; // earlier in Bhadra than day 23 — already gone
    const expected = bsToAdPure(2083, 6, dueDay); // Ashwin (month 6)
    expect(nextBsDueDate(dueDay, today)).toBe(expected);
    expect(nextBsDueDate(dueDay, today) > today).toBe(true);
  });

  it("treats today's own due day as still due this cycle, not rolled", () => {
    expect(nextBsDueDate(23, today)).toBe(today);
  });

  it("clamps an out-of-range due day into 1-32 instead of producing a bad date", () => {
    expect(nextBsDueDate(99, today)).toBe(nextBsDueDate(32, today));
    expect(nextBsDueDate(0, today)).toBe(nextBsDueDate(1, today));
  });
});
