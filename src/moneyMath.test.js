import { describe, it, expect } from "vitest";
import {
  loanPaid,
  loanTotals,
  loanStatus,
  emiInstallmentsPaid,
  emiPayoffDate,
  netLoanPositionPure,
  computeRoomBalancesPure,
  simplifyRoomDebts,
  computeBudgetPace,
} from "./moneyMath.js";

describe("loanPaid", () => {
  it("sums every logged payment", () => {
    const loan = { payments: [{ amount: 1000 }, { amount: 500 }, { amount: 250 }] };
    expect(loanPaid(loan)).toBe(1750);
  });

  it("is 0 when there are no payments yet", () => {
    expect(loanPaid({ payments: [] })).toBe(0);
    expect(loanPaid({})).toBe(0);
  });
});

describe("loanTotals — flat interest", () => {
  it("charges simple interest on the original principal for the whole elapsed period", () => {
    // Rs 100,000 at 12%/year flat, exactly 1 year elapsed, nothing paid yet.
    const loan = {
      principal: 100000, interestRate: 12, interestType: "flat",
      dateGiven: "2025-01-01", payments: [],
    };
    const { interest, totalOwed, outstanding } = loanTotals(loan, "2026-01-01");
    expect(interest).toBeCloseTo(12000, 0);
    expect(totalOwed).toBeCloseTo(112000, 0);
    expect(outstanding).toBeCloseTo(112000, 0);
  });

  it("does not shrink the interest base as payments come in (that's the whole point of 'flat')", () => {
    const loan = {
      principal: 100000, interestRate: 12, interestType: "flat",
      dateGiven: "2025-01-01", payments: [{ date: "2025-07-01", amount: 50000 }],
    };
    // Flat interest only cares about principal × rate × elapsed time — a
    // mid-year payment should reduce `outstanding` but never the interest
    // figure itself.
    const { interest, outstanding } = loanTotals(loan, "2026-01-01");
    expect(interest).toBeCloseTo(12000, 0);
    expect(outstanding).toBeCloseTo(112000 - 50000, 0);
  });
});

describe("loanTotals — reducing-balance interest", () => {
  it("recalculates interest on whatever balance remains after each payment", () => {
    // Rs 100,000 at 12%/year reducing, roughly half paid off ~6 months in.
    const loan = {
      principal: 100000, interestRate: 12, interestType: "reducing",
      dateGiven: "2025-01-01",
      payments: [{ date: "2025-07-02", amount: 50000 }],
    };
    // Mirror the day-count math independently (real day counts, not a
    // clean "0.5 years" assumption) so this is a genuine cross-check
    // rather than restating the implementation.
    const days1 = (new Date("2025-07-02T00:00:00Z") - new Date("2025-01-01T00:00:00Z")) / 86400000;
    const firstInterest = 100000 * 0.12 * (days1 / 365);
    const balanceAfterPayment = 100000 + firstInterest - 50000;
    const days2 = (new Date("2026-01-01T00:00:00Z") - new Date("2025-07-02T00:00:00Z")) / 86400000;
    const secondInterest = balanceAfterPayment * 0.12 * (days2 / 365);
    const expectedInterest = firstInterest + secondInterest;

    const { interest } = loanTotals(loan, "2026-01-01");
    expect(interest).toBeCloseTo(expectedInterest, 5);
  });

  it("owes less total interest than the flat method for the same rate once a mid-term payment is made", () => {
    const base = { principal: 100000, interestRate: 12, dateGiven: "2025-01-01", payments: [{ date: "2025-07-02", amount: 50000 }] };
    const flat = loanTotals({ ...base, interestType: "flat" }, "2026-01-01");
    const reducing = loanTotals({ ...base, interestType: "reducing" }, "2026-01-01");
    expect(reducing.interest).toBeLessThan(flat.interest);
  });
});

describe("loanTotals — no interest", () => {
  it("charges nothing when interestType is 'none' or missing", () => {
    const loan = { principal: 5000, payments: [], dateGiven: "2025-01-01" };
    expect(loanTotals(loan, "2026-01-01").interest).toBe(0);
    expect(loanTotals({ ...loan, interestType: "none", interestRate: 20 }, "2026-01-01").interest).toBe(0);
  });
});

describe("loanStatus", () => {
  const base = { principal: 1000, payments: [], dateGiven: "2026-01-01" };

  it("is Pending before anything is paid and nothing is overdue", () => {
    expect(loanStatus({ ...base }, "2026-01-15")).toBe("Pending");
  });

  it("is Partially Paid once some (but not all) has been paid", () => {
    expect(loanStatus({ ...base, payments: [{ date: "2026-01-10", amount: 200 }] }, "2026-01-15")).toBe("Partially Paid");
  });

  it("is Cleared once outstanding drops to (near) zero", () => {
    expect(loanStatus({ ...base, payments: [{ date: "2026-01-10", amount: 1000 }] }, "2026-01-15")).toBe("Cleared");
  });

  it("is Overdue when the due date has passed and it isn't cleared", () => {
    expect(loanStatus({ ...base, dueDate: "2026-01-01" }, "2026-02-01")).toBe("Overdue");
  });

  it("a cleared loan is never reported Overdue even with a past due date", () => {
    const cleared = { ...base, dueDate: "2026-01-01", payments: [{ date: "2026-01-10", amount: 1000 }] };
    expect(loanStatus(cleared, "2026-02-01")).toBe("Cleared");
  });
});

describe("EMI helpers", () => {
  it("emiInstallmentsPaid counts logged payments, regardless of amount", () => {
    expect(emiInstallmentsPaid({ payments: [{ amount: 100 }, { amount: 100 }] })).toBe(2);
    expect(emiInstallmentsPaid({})).toBe(0);
  });

  it("emiPayoffDate projects one remaining installment per month from today", () => {
    const loan = { isEmi: true, emiTenure: 12, payments: Array(10).fill({ amount: 1 }) };
    // 2 installments left → payoff 2 months from "today".
    expect(emiPayoffDate(loan, "2026-01-15")).toBe("2026-03-15");
  });

  it("emiPayoffDate is null once every installment is already paid", () => {
    const loan = { isEmi: true, emiTenure: 12, payments: Array(12).fill({ amount: 1 }) };
    expect(emiPayoffDate(loan, "2026-01-15")).toBeNull();
  });

  it("emiPayoffDate is null for a non-EMI loan", () => {
    expect(emiPayoffDate({ isEmi: false, emiTenure: 12, payments: [] }, "2026-01-15")).toBeNull();
  });
});

describe("netLoanPositionPure", () => {
  const loans = [
    { type: "lent", principal: 5000, payments: [], dateGiven: "2026-01-01", isEmi: false },
    { type: "borrowed", principal: 2000, payments: [], dateGiven: "2026-01-01", isEmi: false },
    { type: "borrowed", principal: 250000, payments: [], dateGiven: "2026-01-01", isEmi: true, emiAmount: 14579, emiTenure: 24 },
  ];

  it("keeps EMI and regular loans in separate buckets", () => {
    const nonEmi = netLoanPositionPure(loans, "nonEmi");
    expect(nonEmi.lentOutstanding).toBe(5000);
    expect(nonEmi.borrowedOutstanding).toBe(2000);
    expect(nonEmi.net).toBe(3000);

    const emiOnly = netLoanPositionPure(loans, "emi");
    expect(emiOnly.lentOutstanding).toBe(0);
    expect(emiOnly.borrowedOutstanding).toBe(250000);
  });
});

describe("computeRoomBalancesPure", () => {
  it("splits an expense evenly across the people it's shared with", () => {
    const net = computeRoomBalancesPure(
      ["Me", "Ram", "Sita"],
      [{ amount: 1200, paidBy: "Me", splitAmong: ["Me", "Ram", "Sita"] }],
      []
    );
    // Me paid 1200, owes a 400 share → net +800. Ram/Sita each owe 400.
    expect(net.Me).toBeCloseTo(800, 5);
    expect(net.Ram).toBeCloseTo(-400, 5);
    expect(net.Sita).toBeCloseTo(-400, 5);
  });

  it("nets multiple expenses and settlements against each other", () => {
    const net = computeRoomBalancesPure(
      ["Me", "Ram"],
      [
        { amount: 1000, paidBy: "Me", splitAmong: ["Me", "Ram"] },
        { amount: 400, paidBy: "Ram", splitAmong: ["Me", "Ram"] },
      ],
      [{ from: "Ram", to: "Me", amount: 100 }]
    );
    // Expense 1: Me +500, Ram -500. Expense 2: Ram +200, Me -200.
    // Running total before settlement: Me +300, Ram -300.
    // Ram paying Me 100 *settles* that much debt — it moves both figures
    // toward zero, not further apart: Me +200, Ram -200.
    expect(net.Me).toBeCloseTo(200, 5);
    expect(net.Ram).toBeCloseTo(-200, 5);
  });

  it("defaults to splitting across everyone when splitAmong is empty", () => {
    const net = computeRoomBalancesPure(
      ["Me", "Ram", "Sita"],
      [{ amount: 300, paidBy: "Me", splitAmong: [] }],
      []
    );
    expect(net.Ram).toBeCloseTo(-100, 5);
    expect(net.Sita).toBeCloseTo(-100, 5);
  });

  it("the whole group's net balances always sum to zero", () => {
    const net = computeRoomBalancesPure(
      ["Me", "Ram", "Sita"],
      [
        { amount: 900, paidBy: "Me", splitAmong: ["Me", "Ram", "Sita"] },
        { amount: 300, paidBy: "Sita", splitAmong: ["Ram", "Sita"] },
      ],
      [{ from: "Ram", to: "Me", amount: 150 }]
    );
    const total = Object.values(net).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(0, 5);
  });
});

describe("simplifyRoomDebts", () => {
  it("produces the minimum number of settle-up transactions", () => {
    // A owes 100, B owes 200, C is owed 300 — should collapse to exactly
    // two payments straight to C, not a tangle of pairwise debts.
    const settlements = simplifyRoomDebts({ A: -100, B: -200, C: 300 });
    expect(settlements).toHaveLength(2);
    expect(settlements.every(s => s.to === "C")).toBe(true);
    const totalPaid = settlements.reduce((s, x) => s + x.amount, 0);
    expect(totalPaid).toBeCloseTo(300, 5);
  });

  it("ignores balances that round to zero", () => {
    expect(simplifyRoomDebts({ A: 0.1, B: -0.1 })).toEqual([]);
  });

  it("returns no settlements when everyone is already even", () => {
    expect(simplifyRoomDebts({ A: 0, B: 0 })).toEqual([]);
  });
});

describe("computeBudgetPace", () => {
  it("flags overspending when today's daily rate would blow the limit by month end", () => {
    // Rs 10,000 spent by day 10 of a 30-day month, Rs 20,000 limit —
    // projected to hit 30,000, well over.
    const pace = computeBudgetPace(10000, 20000, 10, 30);
    expect(pace.projected).toBeCloseTo(30000, 0);
    expect(pace.overProjected).toBe(true);
  });

  it("does not flag overspending when the projection lands under the limit", () => {
    const pace = computeBudgetPace(3000, 20000, 10, 30);
    expect(pace.projected).toBeCloseTo(9000, 0);
    expect(pace.overProjected).toBe(false);
  });

  it("aheadOfPace is true when spend-so-far is behind the calendar pace", () => {
    // Day 10 of 30 = 33% through the month; only 20% of budget spent.
    const pace = computeBudgetPace(4000, 20000, 10, 30);
    expect(pace.aheadOfPace).toBe(true);
  });

  it("returns null when there's no budget limit set", () => {
    expect(computeBudgetPace(1000, 0, 10, 30)).toBeNull();
    expect(computeBudgetPace(1000, null, 10, 30)).toBeNull();
  });
});
