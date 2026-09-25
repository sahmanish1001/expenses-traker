// Reconstructs "what was I actually worth on date X" from the same
// ledger the rest of the app already keeps — transactions, loans, and
// IPO applications — the same composition pattern src/alertMath.js uses
// (pulling from moneyMath.js + nepaliCalendar.js) to combine domains
// without those domains needing to know about each other.
//
// Deliberately NOT a live portfolio valuation: IPO holdings are valued
// at cost (what was actually paid, per the app's own transaction log),
// never a market price, because Kharchā has no price feed for shares
// once they're listed — see computeIpoResultCheckAlerts() in
// alertMath.js for the same "can't know it, won't fake it" call on the
// allotment-result side of IPOs.
import { loanTotals } from "./moneyMath.js";
import { adToBs, shiftBsMonth, bsToAdPure, NEPALI_MONTHS } from "./nepaliCalendar.js";

// Cash on hand as of `asOf`: every transaction dated on/before it, summed
// in − out. Mirrors renderBalanceCard()'s own comment in main.js — the
// ledger IS the balance, never a separately-tracked snapshot — so a
// historical point here reconstructs exactly what Total Balance would
// have read on that date.
export function cashAsOf(transactions, hiddenAccounts, asOf){
  return (transactions || [])
    .filter(t => !(hiddenAccounts || []).includes(t.account) && t.date <= asOf)
    .reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);
}

// loanInterestAccrued() (see moneyMath.js) walks a loan's FULL payments
// array regardless of `asOf`, which is fine when `asOf` is always today
// (every existing call site) but wrong for a historical point — a
// payment dated after `asOf` hasn't happened yet as of that point, and
// shouldn't already be reducing the balance the interest is accruing on.
// Passing loanTotals() a copy with only the payments dated on/before
// `asOf` keeps its (already-tested) accrual math correct for any date.
export function loanOutstandingAsOf(loan, asOf){
  if (loan.dateGiven && loan.dateGiven > asOf) return 0; // loan didn't exist yet
  const scoped = { ...loan, payments: (loan.payments || []).filter(p => p.date <= asOf) };
  return loanTotals(scoped, asOf).outstanding;
}

export function netLoanPositionAsOf(loans, asOf){
  let lentOutstanding = 0, borrowedOutstanding = 0;
  (loans || []).forEach(l => {
    const outstanding = loanOutstandingAsOf(l, asOf);
    if (l.type === "lent") lentOutstanding += outstanding; else borrowedOutstanding += outstanding;
  });
  return { lentOutstanding, borrowedOutstanding, net: lentOutstanding - borrowedOutstanding };
}

// Money still tied up in IPO applications as of `asOf`: the full blocked
// amount, minus whatever's already been refunded back to cash by then.
// One formula covers every stage without branching on status: a still-
// pending application (nothing refunded yet) counts at its full blocked
// amount — that money hasn't left your name, just your liquid cash; a
// not-allotted application, once refunded, nets to 0 (cash already
// picked it back up, see saveIpoApply()/markIpoRefunded() in main.js —
// counting it here too would double it); an allotted application, once
// its non-allotted portion is refunded, nets to exactly units × price —
// the real cost basis of the shares you now hold.
export function ipoHeldValueAsOf(applications, asOf){
  return (applications || [])
    .filter(a => a.applicationDate <= asOf)
    .reduce((s, a) => {
      const refundedByThen = a.refunded && a.refundedDate && a.refundedDate <= asOf ? a.refundAmount : 0;
      return s + (a.amountBlocked - refundedByThen);
    }, 0);
}

// `data` is the user's full snapshot shape (same one alertMath.js's
// functions take) — transactions, loans, ipoApplications, hiddenAccounts.
export function netWorthAsOf(data, asOf){
  const cash = cashAsOf(data.transactions, data.hiddenAccounts, asOf);
  const loanPos = netLoanPositionAsOf(data.loans, asOf);
  const ipoHeld = ipoHeldValueAsOf(data.ipoApplications, asOf);
  return {
    cash, ipoHeld,
    lentOutstanding: loanPos.lentOutstanding, borrowedOutstanding: loanPos.borrowedOutstanding,
    netWorth: cash + ipoHeld + loanPos.net,
  };
}

function lastAdDayOfBsMonth(year, month){
  const next = shiftBsMonth(year, month, 1);
  const nextFirst = bsToAdPure(next.year, next.month, 1);
  const d = new Date(nextFirst + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// One point per the last `months` real BS months, oldest to newest — same
// window Insights' existing "Last 6 months" spending trend uses, just
// cumulative (net worth as of month-end) instead of per-period (spend
// within the month). The most recent point is valued as of `today`
// itself, since that month isn't over yet; every earlier point is valued
// as of that month's actual last day.
export function computeNetWorthTrend(data, today, months = 6){
  const cur = adToBs(today);
  const points = [];
  for (let i = months - 1; i >= 0; i--){
    const m = shiftBsMonth(cur.year, cur.month, -i);
    const asOf = i === 0 ? today : lastAdDayOfBsMonth(m.year, m.month);
    points.push({
      key: `${m.year}-${m.month}`,
      label: `${NEPALI_MONTHS[m.month - 1].name.slice(0, 3)} ${String(m.year).slice(-2)}`,
      asOf,
      netWorth: netWorthAsOf(data, asOf).netWorth,
    });
  }
  return points;
}

if (typeof window !== "undefined"){
  Object.assign(window, {
    cashAsOf, loanOutstandingAsOf, netLoanPositionAsOf, ipoHeldValueAsOf, netWorthAsOf, computeNetWorthTrend,
  });
}
