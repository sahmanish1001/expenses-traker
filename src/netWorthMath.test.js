import { describe, it, expect } from "vitest";
import { cashAsOf, loanOutstandingAsOf, netLoanPositionAsOf, ipoHeldValueAsOf, netWorthAsOf, computeNetWorthTrend } from "./netWorthMath.js";

describe("cashAsOf", () => {
  const transactions = [
    { date: "2026-08-01", type: "in", amount: 10000, account: "eSewa" },
    { date: "2026-08-15", type: "out", amount: 2000, account: "eSewa" },
    { date: "2026-09-01", type: "out", amount: 3000, account: "eSewa" },
  ];

  it("sums in minus out for everything dated on/before asOf", () => {
    expect(cashAsOf(transactions, [], "2026-08-31")).toBe(8000);
  });

  it("excludes anything dated after asOf", () => {
    expect(cashAsOf(transactions, [], "2026-08-10")).toBe(10000);
  });

  it("excludes hidden accounts", () => {
    const withHidden = [...transactions, { date: "2026-08-01", type: "in", amount: 99999, account: "Old Wallet" }];
    expect(cashAsOf(withHidden, ["Old Wallet"], "2026-09-30")).toBe(5000);
  });
});

describe("loanOutstandingAsOf", () => {
  it("is 0 before the loan even existed", () => {
    const loan = { dateGiven: "2026-08-01", principal: 5000, payments: [] };
    expect(loanOutstandingAsOf(loan, "2026-07-01")).toBe(0);
  });

  it("ignores payments dated after asOf", () => {
    const loan = { dateGiven: "2026-08-01", principal: 5000, payments: [{ date: "2026-09-15", amount: 5000 }] };
    expect(loanOutstandingAsOf(loan, "2026-09-01")).toBe(5000);
  });

  it("counts a payment dated on/before asOf", () => {
    const loan = { dateGiven: "2026-08-01", principal: 5000, payments: [{ date: "2026-08-15", amount: 2000 }] };
    expect(loanOutstandingAsOf(loan, "2026-09-01")).toBe(3000);
  });
});

describe("netLoanPositionAsOf", () => {
  it("splits lent vs borrowed and nets them", () => {
    const loans = [
      { type: "lent", dateGiven: "2026-08-01", principal: 3000, payments: [] },
      { type: "borrowed", dateGiven: "2026-08-01", principal: 1000, payments: [] },
    ];
    expect(netLoanPositionAsOf(loans, "2026-09-01")).toEqual({ lentOutstanding: 3000, borrowedOutstanding: 1000, net: 2000 });
  });
});

describe("ipoHeldValueAsOf", () => {
  it("counts a still-pending application at its full blocked amount", () => {
    const apps = [{ applicationDate: "2026-08-01", amountBlocked: 1000, refunded: false, refundAmount: null, refundedDate: null }];
    expect(ipoHeldValueAsOf(apps, "2026-09-01")).toBe(1000);
  });

  it("nets a not-allotted, refunded application to 0", () => {
    const apps = [{ applicationDate: "2026-08-01", amountBlocked: 1000, refunded: true, refundAmount: 1000, refundedDate: "2026-08-20" }];
    expect(ipoHeldValueAsOf(apps, "2026-09-01")).toBe(0);
  });

  it("nets an allotted, partially-refunded application to its cost basis", () => {
    const apps = [{ applicationDate: "2026-08-01", amountBlocked: 1000, refunded: true, refundAmount: 400, refundedDate: "2026-08-20" }];
    expect(ipoHeldValueAsOf(apps, "2026-09-01")).toBe(600);
  });

  it("still counts the full blocked amount if the refund hasn't been logged yet", () => {
    const apps = [{ applicationDate: "2026-08-01", amountBlocked: 1000, refunded: false, refundAmount: 400, refundedDate: null }];
    expect(ipoHeldValueAsOf(apps, "2026-09-01")).toBe(1000);
  });

  it("excludes an application made after asOf", () => {
    const apps = [{ applicationDate: "2026-09-15", amountBlocked: 1000, refunded: false, refundAmount: null, refundedDate: null }];
    expect(ipoHeldValueAsOf(apps, "2026-09-01")).toBe(0);
  });
});

describe("netWorthAsOf", () => {
  it("combines cash, loans, and IPO holdings", () => {
    const data = {
      transactions: [{ date: "2026-08-01", type: "in", amount: 10000, account: "eSewa" }],
      hiddenAccounts: [],
      loans: [{ type: "lent", dateGiven: "2026-08-01", principal: 2000, payments: [] }],
      ipoApplications: [{ applicationDate: "2026-08-01", amountBlocked: 1000, refunded: false, refundAmount: null, refundedDate: null }],
    };
    const result = netWorthAsOf(data, "2026-09-01");
    expect(result).toEqual({ cash: 10000, ipoHeld: 1000, lentOutstanding: 2000, borrowedOutstanding: 0, netWorth: 13000 });
  });
});

describe("computeNetWorthTrend", () => {
  const today = "2026-09-07"; // BS Bhadra 2083 (2083-5, matching alertMath.test.js's fixture)

  it("returns one point per month, oldest to newest, ending at today's month", () => {
    const data = { transactions: [], hiddenAccounts: [], loans: [], ipoApplications: [] };
    const points = computeNetWorthTrend(data, today, 3);
    expect(points).toHaveLength(3);
    expect(points.map(p => p.key)).toEqual(["2083-3", "2083-4", "2083-5"]);
    expect(points[2].asOf).toBe(today);
  });

  it("values the most recent point as of today, not the month's last day", () => {
    const data = {
      transactions: [{ date: "2026-09-05", type: "in", amount: 500, account: "eSewa" }],
      hiddenAccounts: [], loans: [], ipoApplications: [],
    };
    const points = computeNetWorthTrend(data, today, 1);
    expect(points[0].netWorth).toBe(500);
  });

  it("values an earlier point as of that month's actual last day", () => {
    const data = {
      transactions: [
        { date: "2026-08-01", type: "in", amount: 1000, account: "eSewa" }, // BS Shrawan
        { date: "2026-09-05", type: "in", amount: 500, account: "eSewa" },  // BS Bhadra — after Shrawan ends
      ],
      hiddenAccounts: [], loans: [], ipoApplications: [],
    };
    const points = computeNetWorthTrend(data, today, 2);
    expect(points[0].key).toBe("2083-4"); // Shrawan
    expect(points[0].netWorth).toBe(1000); // the Bhadra transaction hasn't happened yet as of Shrawan's end
    expect(points[1].netWorth).toBe(1500);
  });
});
