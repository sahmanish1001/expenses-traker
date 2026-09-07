// Nepali (Bikram Sambat) calendar conversion — pulled out of
// public/main.js into a real, testable ES module the same way
// src/moneyMath.js already was (see that file's top comment for why).
// Loaded before both moneyMath.js and main.js in index.html; main.js
// keeps using these as plain globals, completely unaware they now live
// here.
//
// Nepal's BS calendar doesn't follow a fixed formula (each month's length
// is fixed by the official Nepali calendar and can shift by a day from
// year to year), so this uses the well-established month-start dates that
// hold for the current era (~2018-2035 AD / BS 2075-2091). Day-of-month
// can occasionally be off by a day right at a month boundary in some
// years; month and year are reliable, which is what grouping-by-month
// (budget periods, recurring due dates, Insights) depends on.

export const NEPALI_MONTHS = [
  { name: "Baisakh", color: "#f2a93b" },
  { name: "Jestha",  color: "#5fd1a4" },
  { name: "Asar",    color: "#ef6f6c" },
  { name: "Shrawan", color: "#7f9cf5" },
  { name: "Bhadra",  color: "#c792ea" },
  { name: "Ashwin",  color: "#e8a87c" },
  { name: "Kartik",  color: "#6ec6dc" },
  { name: "Mangsir", color: "#8fd19e" },
  { name: "Poush",   color: "#e0473e" },
  { name: "Magh",    color: "#3aa655" },
  { name: "Falgun",  color: "#b98cce" },
  { name: "Chaitra", color: "#f2c14e" },
];
// [adMonth, adDay] each BS month begins on, for a BS year that starts
// (Baisakh 1) in April of a given AD year "Y". Magh/Falgun/Chaitra fall
// in Y+1.
export const BS_MONTH_STARTS = [
  [4, 13], [5, 14], [6, 14], [7, 16], [8, 16], [9, 17],
  [10, 17], [11, 16], [12, 15], [1, 14], [2, 12], [3, 14],
];

// Returns the 12 month-start boundaries (as real Date objects) for the BS
// year that begins Baisakh 1 in April of AD year Y.
export function bsBoundariesForBaisakhYear(Y){
  return BS_MONTH_STARTS.map(([adMonth, adDay], i) => {
    const adYear = adMonth <= 3 ? Y + 1 : Y; // Magh(10)/Falgun(11)/Chaitra(12) land in Jan-Mar of Y+1
    return {
      date: new Date(Date.UTC(adYear, adMonth - 1, adDay)),
      bsMonth: i + 1,
      bsYear: Y + 57,
    };
  });
}

export function adToBs(dateStr){
  const d = new Date(dateStr + "T00:00:00Z");
  const adYear = d.getUTCFullYear();
  // The boundary that applies could belong to "this AD year's Baisakh"
  // or the previous one (for Jan/Feb/early-Mar dates), so build both.
  const candidates = [
    ...bsBoundariesForBaisakhYear(adYear - 1),
    ...bsBoundariesForBaisakhYear(adYear),
  ].sort((a, b) => a.date - b.date);

  let match = candidates[0];
  for (const c of candidates){
    if (c.date <= d) match = c; else break;
  }
  const dayDiff = Math.round((d - match.date) / 86400000) + 1;
  return { year: match.bsYear, month: match.bsMonth, day: dayDiff };
}

export function bsLabel(dateStr){
  const bs = adToBs(dateStr);
  return `${NEPALI_MONTHS[bs.month - 1].name} ${bs.day}, ${bs.year}`;
}

// Reverse of adToBs — a BS year/month/day back to an AD "YYYY-MM-DD"
// string. Used for anything set by a Nepali calendar day (like a rent or
// recurring-bill due day) that then needs real date math (countdowns,
// overdue checks). Returns null for an out-of-range bsMonth instead of
// silently defaulting to "today" — callers that want that fallback (only
// main.js's bsToAd() wrapper does) apply it themselves, so this stays a
// pure function of its three inputs.
export function bsToAdPure(bsYear, bsMonth, bsDay){
  const Y = bsYear - 57;
  const boundary = bsBoundariesForBaisakhYear(Y).find(b => b.bsMonth === bsMonth);
  if (!boundary) return null;
  const d = new Date(boundary.date.getTime() + (bsDay - 1) * 86400000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function bsMonthKey(dateStr){
  const bs = adToBs(dateStr);
  return `${bs.year}-${bs.month}`;
}

export function shiftBsMonth(year, month, delta){
  const total = (year * 12 + (month - 1)) + delta;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

// Shared by Recurring bills (recurringDueDate(dueDay)) and Room rent
// (currentRentDueDate()) in main.js — both used to duplicate this exact
// "which BS day-of-month, this cycle or next" logic inline. Given a day
// of the BS month and today's AD date, returns the next AD date that day
// falls on: this BS month if it hasn't passed yet, otherwise next month.
export function nextBsDueDate(dueDay, today){
  const day = Math.min(Math.max(1, parseInt(dueDay, 10) || 1), 32);
  const todayBs = adToBs(today);
  let due = bsToAdPure(todayBs.year, todayBs.month, day) || today;
  if (due < today){
    const next = shiftBsMonth(todayBs.year, todayBs.month, 1);
    due = bsToAdPure(next.year, next.month, day) || today;
  }
  return due;
}

if (typeof window !== "undefined"){
  Object.assign(window, {
    NEPALI_MONTHS, BS_MONTH_STARTS, bsBoundariesForBaisakhYear, adToBs, bsLabel,
    bsToAdPure, bsMonthKey, shiftBsMonth, nextBsDueDate,
  });
}
