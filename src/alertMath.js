// Pure "does this user have something worth alerting about right now"
// logic, shared by two very different callers: checkAlerts() in
// public/main.js (an on-app-open toast, one at a time) and
// scripts/send-push-notifications.mjs (a scheduled server-side scan that
// can surface every applicable alert, not just the first). Keeping the
// actual conditions here — not reimplemented separately in each caller —
// is what guarantees a push notification and the in-app toast can never
// quietly disagree about what counts as "due soon" or "over budget".
//
// Every function here takes today as an explicit string (never reads the
// clock itself), the same reason moneyMath.js's functions do: the caller
// might be a browser in Nepal or a GitHub Actions runner in UTC, and only
// the caller knows how to get "today" right for where it's running.
import { daysBetween, loanStatus, loanTotals } from "./moneyMath.js";
import { ipoStatus } from "./ipoMath.js";
import { bsMonthKey } from "./nepaliCalendar.js";

// `data` is a user's full snapshot shape (transactions, budgetOverall,
// hiddenAccounts, ...) — the same shape buildUserDataSnapshot() in
// main.js produces and what's stored per-row in the `user_data` table.
export function computeBudgetAlert(data, today){
  if (!data.budgetOverall) return null;
  const monthKey = bsMonthKey(today);
  const hidden = data.hiddenAccounts || [];
  const spent = (data.transactions || [])
    .filter(t => t.type === "out" && !hidden.includes(t.account) && bsMonthKey(t.date) === monthKey)
    .reduce((s, t) => s + t.amount, 0);
  if (spent < data.budgetOverall) return null;
  return {
    key: `budget:${monthKey}`,
    title: "Over budget",
    body: `You're Rs ${Math.round(spent - data.budgetOverall).toLocaleString("en-IN")} over your overall budget this month.`,
    url: "/",
  };
}

export function computeLoanAlerts(data, today){
  const alerts = [];
  for (const loan of data.loans || []){
    if (!loan.dueDate || loanStatus(loan, today) === "Cleared") continue;
    const days = Math.round(daysBetween(today, loan.dueDate));
    if (days > 3) continue;
    const when = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "due today" : `due in ${days}d`;
    const { outstanding } = loanTotals(loan, today);
    alerts.push({
      key: `loan:${loan.id}:${loan.dueDate}`,
      title: loan.isEmi ? "EMI due soon" : "Loan due soon",
      body: `${loan.isEmi ? "EMI to" : "Loan with"} ${loan.person} — ${when} (Rs ${Math.round(outstanding).toLocaleString("en-IN")} outstanding).`,
      url: "/",
    });
  }
  return alerts;
}

// `sharedIpos` is the scraped public calendar (already in the app's
// {id, company, openDate, closeDate, listed} shape) — merged with the
// user's own hand-added IPOs the same way the IPO Calendar page itself
// does, so a push fires for either kind exactly like the in-app alert.
export function computeIpoAlerts(data, sharedIpos, today){
  const alerts = [];
  const all = [...(data.ipos || []), ...sharedIpos];
  for (const ipo of all){
    if (ipoStatus(ipo, today) !== "Open") continue;
    const days = Math.round(daysBetween(today, ipo.closeDate));
    if (days < 0 || days > 2) continue;
    alerts.push({
      key: `ipo:${ipo.id}`,
      title: "IPO closing soon",
      body: `${ipo.company} closes ${days === 0 ? "today" : `in ${days}d`} — apply now if you're interested.`,
      url: "/",
    });
  }
  return alerts;
}

export function computeAllAlerts(data, sharedIpos, today){
  return [
    computeBudgetAlert(data, today),
    ...computeLoanAlerts(data, today),
    ...computeIpoAlerts(data, sharedIpos, today),
  ].filter(Boolean);
}

if (typeof window !== "undefined"){
  Object.assign(window, { computeBudgetAlert, computeLoanAlerts, computeIpoAlerts, computeAllAlerts });
}
