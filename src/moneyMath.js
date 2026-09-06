// Pure money-math functions — loan interest/EMI, budget pacing, and room
// settle-up. Pulled out of public/main.js into a real, testable ES module
// (see moneyMath.test.js) so a redesign can never silently change what a
// number on screen actually means without a test catching it.
//
// Loaded in the browser as a <script type="module"> (see index.html),
// BEFORE the classic, non-module <script defer src="/main.js">, and
// exposes everything on `window` at the bottom of this file — main.js
// still calls these as plain global functions (loanTotals(...), etc.),
// completely unaware they now live in a separate file. That's also why
// every function here takes its data as plain arguments instead of
// reading app globals like LOANS/ROOMMATES directly: main.js's own
// thin wrappers (netLoanPosition(), computeRoomBalances()) pass those
// globals in, which is what makes the functions here testable in
// isolation with made-up data.

export function todayStr(d = new Date()){
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysBetween(d1, d2){
  return (new Date(d2 + "T00:00:00Z") - new Date(d1 + "T00:00:00Z")) / 86400000;
}

export function loanPaid(loan){
  return (loan.payments || []).reduce((s, p) => s + p.amount, 0);
}

// Interest accrued as of `asOf` (defaults to today).
// "flat": simple interest on the original principal for the whole elapsed
//         period — the rate a lot of informal loans in Nepal are quoted at.
// "reducing": interest is recalculated on the balance still outstanding
//         after each payment, so it shrinks as the loan gets paid down —
//         the bank-style method, and the usual source of confusion with
//         "flat" rates that quote the same-looking % per year.
export function loanInterestAccrued(loan, asOf){
  asOf = asOf || todayStr();
  const rate = Number(loan.interestRate) || 0;
  if (!rate || !loan.interestType || loan.interestType === "none") return 0;
  if (loan.interestType === "flat"){
    const years = Math.max(0, daysBetween(loan.dateGiven, asOf) / 365);
    return loan.principal * (rate / 100) * years;
  }
  // reducing balance
  const events = [...(loan.payments || [])].sort((a, b) => a.date < b.date ? -1 : 1);
  let balance = loan.principal;
  let cursor = loan.dateGiven;
  let interestAccrued = 0;
  events.forEach(ev => {
    const yrs = Math.max(0, daysBetween(cursor, ev.date) / 365);
    const periodInterest = balance * (rate / 100) * yrs;
    interestAccrued += periodInterest;
    balance = Math.max(0, balance + periodInterest - ev.amount);
    cursor = ev.date;
  });
  const yrsToAsOf = Math.max(0, daysBetween(cursor, asOf) / 365);
  interestAccrued += balance * (rate / 100) * yrsToAsOf;
  return interestAccrued;
}

export function loanTotals(loan, asOf){
  const paid = loanPaid(loan);
  const interest = loanInterestAccrued(loan, asOf);
  const totalOwed = loan.principal + interest;
  const outstanding = Math.max(0, totalOwed - paid);
  return { paid, interest, totalOwed, outstanding };
}

// Projects when an EMI loan will be fully paid off, assuming the
// remaining installments land roughly one per month from `today`.
export function emiInstallmentsPaid(loan){
  return (loan.payments || []).length;
}

export function emiPayoffDate(loan, today){
  if (!loan.isEmi || !loan.emiTenure) return null;
  const remaining = loan.emiTenure - emiInstallmentsPaid(loan);
  if (remaining <= 0) return null;
  const d = new Date((today || todayStr()) + "T00:00:00");
  d.setMonth(d.getMonth() + remaining);
  // Format from local date parts (via todayStr(), which already does
  // this) instead of d.toISOString() — toISOString() converts to UTC,
  // which silently shifts the date back a day for anyone in a timezone
  // ahead of UTC (Nepal is UTC+5:45) — exactly the app's own audience.
  // Caught by moneyMath.test.js expecting a payoff date that lands on
  // the same day of the month as today, not the day before.
  return todayStr(d);
}

export const LOAN_STATUS_META = {
  "Pending":         { color: "#9396a8", bg: "rgba(147,150,168,.16)" },
  "Partially Paid":  { color: "#f59e0b", bg: "rgba(245,158,11,.16)" },
  "Cleared":         { color: "#22c55e", bg: "rgba(34,197,94,.16)" },
  "Overdue":         { color: "#f97316", bg: "rgba(249,115,22,.16)" },
};

export function loanStatus(loan, today){
  today = today || todayStr();
  const { outstanding } = loanTotals(loan, today);
  if (outstanding <= 0.5) return "Cleared";
  if (loan.dueDate && loan.dueDate < today) return "Overdue";
  return loanPaid(loan) > 0 ? "Partially Paid" : "Pending";
}

// scope: "all" | "emi" | "nonEmi". Exposed on window as
// netLoanPositionPure (not netLoanPosition) — main.js keeps its own
// netLoanPosition(scope) as a thin wrapper around this, so every existing
// netLoanPosition(scope) call site in main.js needs no changes at all.
export function netLoanPositionPure(loans, scope){
  let lentOutstanding = 0, borrowedOutstanding = 0;
  loans.forEach(l => {
    if (scope === "emi" && !l.isEmi) return;
    if (scope === "nonEmi" && l.isEmi) return;
    const { outstanding } = loanTotals(l);
    if (l.type === "lent") lentOutstanding += outstanding;
    else borrowedOutstanding += outstanding;
  });
  return { lentOutstanding, borrowedOutstanding, net: lentOutstanding - borrowedOutstanding };
}

// Each roommate's net position: positive = owed to them, negative = they
// owe. Always derived from the full expense/settlement log rather than
// stored directly, so it can never drift out of sync with the log.
// Exposed on window as computeRoomBalancesPure — main.js's own
// computeRoomBalances() (no args) is a thin wrapper around this.
export function computeRoomBalancesPure(roommates, roomExpenses, roomSettlements){
  const net = {};
  roommates.forEach(n => { net[n] = 0; });
  roomExpenses.forEach(e => {
    const participants = (e.splitAmong && e.splitAmong.length)
      ? e.splitAmong.filter(n => roommates.includes(n))
      : roommates.slice();
    if (!participants.length) return;
    const share = e.amount / participants.length;
    participants.forEach(p => { net[p] = (net[p] || 0) - share; });
    net[e.paidBy] = (net[e.paidBy] || 0) + e.amount;
  });
  roomSettlements.forEach(s => {
    net[s.from] = (net[s.from] || 0) + s.amount;
    net[s.to] = (net[s.to] || 0) - s.amount;
  });
  return net;
}

// Greedily matches the biggest creditor against the biggest debtor each
// round, which minimizes the number of settle-up transactions needed —
// the same trick Splitwise uses instead of listing every pairwise debt.
export function simplifyRoomDebts(net){
  const creditors = [], debtors = [];
  Object.entries(net).forEach(([name, amt]) => {
    if (amt > 0.5) creditors.push({ name, amt });
    else if (amt < -0.5) debtors.push({ name, amt: -amt });
  });
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);
  const settlements = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length){
    const c = creditors[ci], d = debtors[di];
    const amt = Math.min(c.amt, d.amt);
    settlements.push({ from: d.name, to: c.name, amount: amt });
    c.amt -= amt; d.amt -= amt;
    if (c.amt < 0.5) ci++;
    if (d.amt < 0.5) di++;
  }
  return settlements;
}

// The actual "will I go over budget" projection math behind Budget's
// pacing bar — kept separate from bsMonthProgress() (which figures out
// daysElapsed/daysTotal from the Nepali calendar) and from the HTML that
// renders it, so the projection formula itself is what gets tested here.
export function computeBudgetPace(spent, limit, daysElapsed, daysTotal){
  if (!limit || limit <= 0 || !daysTotal) return null;
  const spentPct = Math.min(100, (spent / limit) * 100);
  const pacePct = Math.min(100, (daysElapsed / daysTotal) * 100);
  const projected = daysElapsed > 0 ? (spent / daysElapsed) * daysTotal : spent;
  const overProjected = projected > limit;
  const aheadOfPace = spentPct <= pacePct;
  return { spentPct, pacePct, projected, overProjected, aheadOfPace };
}

if (typeof window !== "undefined"){
  Object.assign(window, {
    loanPaid, loanInterestAccrued, loanTotals, emiInstallmentsPaid, emiPayoffDate,
    LOAN_STATUS_META, loanStatus, netLoanPositionPure, computeRoomBalancesPure,
    simplifyRoomDebts, computeBudgetPace,
  });
}
