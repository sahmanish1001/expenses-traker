// Pure IPO-calendar math — status derivation, application amount, the
// allotment/refund outcome, and the "My Applications" ROI totals. Pulled
// out of public/main.js into a real, testable ES module the same way
// src/moneyMath.js already was (see the comment at the top of that file
// for why: main.js is a classic, non-module script loaded after this one,
// and picks these up as plain globals — see the bottom of this file).
import { bsMonthKey } from "./nepaliCalendar.js";
import { daysBetween } from "./moneyMath.js";

// "status" is never stored on an IPO — every caller already passes
// `today` explicitly (never relies on a default), so this stays a pure
// function of its two inputs and can never drift out of sync with what's
// actually on screen.
export function ipoStatus(ipo, today){
  if (ipo.listed) return "Listed";
  if (today < ipo.openDate) return "Upcoming";
  if (today <= ipo.closeDate) return "Open";
  return "Closed";
}

export const IPO_STATUS_META = {
  "Upcoming": { color: "#9396a8", bg: "rgba(147,150,168,.16)" },
  "Open":     { color: "#22c55e", bg: "rgba(34,197,94,.16)" },
  "Closed":   { color: "#f59e0b", bg: "rgba(245,158,11,.16)" },
  "Listed":   { color: "#3b82f6", bg: "rgba(59,130,246,.16)" },
};

export function computeIpoApplicationAmount(unitsApplied, price){
  return unitsApplied * price;
}

// The result of an allotment outcome: how many units actually landed, and
// what's owed back. "Not allotted" always refunds the full blocked
// amount; "allotted" refunds whatever wasn't converted into units at the
// IPO's price — 0 when every applied-for unit was allotted.
export function computeIpoAllotmentResult(app, outcome, unitsAllotted){
  if (outcome === "allotted"){
    return {
      status: "Allotted",
      unitsAllotted,
      refundAmount: Math.max(0, app.amountBlocked - (unitsAllotted * app.price)),
    };
  }
  return { status: "Not Allotted", unitsAllotted: 0, refundAmount: app.amountBlocked };
}

// The three stat-tile totals on the IPO page: money blocked across every
// application, the value of whatever was actually allotted, and how much
// has actually been refunded (not just owed — "refunded" is only true
// once markIpoRefunded() has logged the inflow transaction).
export function computeIpoRoiTotals(applications){
  const totalApplied = applications.reduce((s, a) => s + a.amountBlocked, 0);
  const totalAllotted = applications.filter(a => a.unitsAllotted).reduce((s, a) => s + (a.unitsAllotted * a.price), 0);
  const totalRefunded = applications.filter(a => a.refunded).reduce((s, a) => s + a.refundAmount, 0);
  return { totalApplied, totalAllotted, totalRefunded };
}

// The totals row only ever shows "so far, all time" — this is the same
// three numbers broken out by the BS month each application was made in,
// so a trend ("applying more than I'm getting refunded lately", say) is
// actually visible instead of buried in one running total. Sorted
// chronologically (oldest first) since that's how a trend reads.
export function computeIpoRoiTrend(applications){
  const byMonth = new Map();
  for (const app of applications){
    const key = bsMonthKey(app.applicationDate);
    if (!byMonth.has(key)) byMonth.set(key, { monthKey: key, applied: 0, allotted: 0, refunded: 0 });
    const bucket = byMonth.get(key);
    bucket.applied += app.amountBlocked;
    if (app.unitsAllotted) bucket.allotted += app.unitsAllotted * app.price;
    if (app.refunded) bucket.refunded += app.refundAmount;
  }
  return [...byMonth.values()].sort((a, b) => a.monthKey < b.monthKey ? -1 : 1);
}

// Real, computable stats for the "Historical Efficiency" panel — every
// number here is derived straight from IPO_APPLICATIONS, never a
// fabricated/estimated figure. Notably does NOT include anything like a
// listing-day price gain — Kharchā doesn't track post-listing market
// prices, so there's no honest way to compute one.
export function computeIpoEfficiencyStats(applications){
  // Still locked up: the whole blocked amount while the result is
  // unknown, or just the unrefunded remainder once it is — the allotted
  // portion isn't "blocked" any more, it's converted into owned units.
  const blockedLiquidity = applications.reduce((s, a) => {
    if (a.status === "Applied") return s + a.amountBlocked;
    if (!a.refunded && a.refundAmount) return s + a.refundAmount;
    return s;
  }, 0);

  // Unit-for-unit allotment rate (not a money ratio) — only counts
  // applications whose result is actually known.
  const decided = applications.filter(a => a.unitsAllotted != null);
  const unitsApplied = decided.reduce((s, a) => s + a.unitsApplied, 0);
  const unitsAllotted = decided.reduce((s, a) => s + a.unitsAllotted, 0);
  const allotmentRatePct = unitsApplied > 0 ? (unitsAllotted / unitsApplied) * 100 : null;

  // Application date -> the day the refund was actually logged, averaged
  // across every refund that's happened so far.
  const refundedWithDates = applications.filter(a => a.refunded && a.refundedDate);
  const avgRefundDays = refundedWithDates.length
    ? refundedWithDates.reduce((s, a) => s + daysBetween(a.applicationDate, a.refundedDate), 0) / refundedWithDates.length
    : null;

  const pendingRefundsCount = applications.filter(a => a.refundAmount > 0 && !a.refunded).length;

  return { blockedLiquidity, allotmentRatePct, avgRefundDays, pendingRefundsCount };
}

if (typeof window !== "undefined"){
  Object.assign(window, {
    ipoStatus, IPO_STATUS_META, computeIpoApplicationAmount,
    computeIpoAllotmentResult, computeIpoRoiTotals, computeIpoRoiTrend,
    computeIpoEfficiencyStats,
  });
}
