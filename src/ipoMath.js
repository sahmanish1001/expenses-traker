// Pure IPO-calendar math — status derivation, application amount, the
// allotment/refund outcome, and the "My Applications" ROI totals. Pulled
// out of public/main.js into a real, testable ES module the same way
// src/moneyMath.js already was (see the comment at the top of that file
// for why: main.js is a classic, non-module script loaded after this one,
// and picks these up as plain globals — see the bottom of this file).

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

if (typeof window !== "undefined"){
  Object.assign(window, {
    ipoStatus, IPO_STATUS_META, computeIpoApplicationAmount,
    computeIpoAllotmentResult, computeIpoRoiTotals,
  });
}
