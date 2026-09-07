import { describe, it, expect } from "vitest";
import { computeBudgetAlert, computeLoanAlerts, computeIpoAlerts, computeAllAlerts } from "./alertMath.js";

describe("computeBudgetAlert", () => {
  const today = "2026-09-07"; // BS 2083-5

  it("is null when there's no overall budget set", () => {
    expect(computeBudgetAlert({ transactions: [] }, today)).toBeNull();
  });

  it("is null when spend is under the budget", () => {
    const data = {
      budgetOverall: 20000,
      transactions: [{ date: today, type: "out", account: "eSewa", amount: 5000 }],
    };
    expect(computeBudgetAlert(data, today)).toBeNull();
  });

  it("fires once spend meets or exceeds the budget, keyed to this BS month", () => {
    const data = {
      budgetOverall: 20000,
      transactions: [{ date: today, type: "out", account: "eSewa", amount: 25000 }],
    };
    const alert = computeBudgetAlert(data, today);
    expect(alert.key).toBe("budget:2083-5");
    expect(alert.body).toContain("5,000");
  });

  it("ignores income (type 'in') and hidden accounts when summing spend", () => {
    const data = {
      budgetOverall: 1000,
      hiddenAccounts: ["Old Wallet"],
      transactions: [
        { date: today, type: "in", account: "eSewa", amount: 50000 },
        { date: today, type: "out", account: "Old Wallet", amount: 50000 },
        { date: today, type: "out", account: "eSewa", amount: 500 },
      ],
    };
    expect(computeBudgetAlert(data, today)).toBeNull();
  });

  it("ignores spend from a different BS month", () => {
    const data = {
      budgetOverall: 1000,
      transactions: [{ date: "2026-01-01", type: "out", account: "eSewa", amount: 5000 }],
    };
    expect(computeBudgetAlert(data, today)).toBeNull();
  });
});

describe("computeLoanAlerts", () => {
  const today = "2026-09-07";

  it("flags a loan due within 3 days", () => {
    const data = { loans: [{ id: "l1", person: "Sabin", dueDate: "2026-09-09", payments: [], principal: 3000 }] };
    const alerts = computeLoanAlerts(data, today);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].key).toBe("loan:l1:2026-09-09");
    expect(alerts[0].body).toContain("Sabin");
  });

  it("does not flag a loan due more than 3 days out", () => {
    const data = { loans: [{ id: "l1", person: "Sabin", dueDate: "2026-09-20", payments: [], principal: 3000 }] };
    expect(computeLoanAlerts(data, today)).toHaveLength(0);
  });

  it("flags an overdue loan too", () => {
    const data = { loans: [{ id: "l1", person: "Sabin", dueDate: "2026-09-01", payments: [], principal: 3000 }] };
    const alerts = computeLoanAlerts(data, today);
    expect(alerts[0].body).toContain("overdue");
  });

  it("never flags a fully cleared loan", () => {
    const data = { loans: [{ id: "l1", person: "Sabin", dueDate: "2026-09-08", payments: [{ date: today, amount: 3000 }], principal: 3000 }] };
    expect(computeLoanAlerts(data, today)).toHaveLength(0);
  });

  it("distinguishes EMI loans in the title/body", () => {
    const data = { loans: [{ id: "l1", person: "Bank", dueDate: "2026-09-08", payments: [], principal: 80000, isEmi: true, emiAmount: 7500 }] };
    expect(computeLoanAlerts(data, today)[0].title).toBe("EMI due soon");
  });

  it("returns one alert per qualifying loan, not just the first", () => {
    const data = {
      loans: [
        { id: "l1", person: "A", dueDate: "2026-09-08", payments: [], principal: 100 },
        { id: "l2", person: "B", dueDate: "2026-09-09", payments: [], principal: 200 },
      ],
    };
    expect(computeLoanAlerts(data, today)).toHaveLength(2);
  });
});

describe("computeIpoAlerts", () => {
  const today = "2026-09-07";

  it("flags an open IPO closing within 2 days", () => {
    const shared = [{ id: "ss-x", company: "Beni Hydropower", openDate: "2026-09-01", closeDate: "2026-09-09" }];
    const alerts = computeIpoAlerts({}, shared, today);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].key).toBe("ipo:ss-x");
    expect(alerts[0].body).toContain("Beni Hydropower");
  });

  it("does not flag an IPO closing more than 2 days out", () => {
    const shared = [{ id: "ss-x", company: "X", openDate: "2026-09-01", closeDate: "2026-09-15" }];
    expect(computeIpoAlerts({}, shared, today)).toHaveLength(0);
  });

  it("does not flag an IPO that's still upcoming (not open yet)", () => {
    const shared = [{ id: "ss-x", company: "X", openDate: "2026-09-08", closeDate: "2026-09-09" }];
    expect(computeIpoAlerts({}, shared, today)).toHaveLength(0);
  });

  it("does not flag an already-closed IPO", () => {
    const shared = [{ id: "ss-x", company: "X", openDate: "2026-08-01", closeDate: "2026-09-01" }];
    expect(computeIpoAlerts({}, shared, today)).toHaveLength(0);
  });

  it("checks both the user's own IPOs and the shared calendar", () => {
    const data = { ipos: [{ id: "own1", company: "Mine", openDate: "2026-09-01", closeDate: "2026-09-08" }] };
    const shared = [{ id: "ss-x", company: "Shared", openDate: "2026-09-01", closeDate: "2026-09-08" }];
    expect(computeIpoAlerts(data, shared, today)).toHaveLength(2);
  });
});

describe("computeAllAlerts", () => {
  it("combines all three categories into one flat list", () => {
    const today = "2026-09-07";
    const data = {
      budgetOverall: 100,
      transactions: [{ date: today, type: "out", account: "eSewa", amount: 500 }],
      loans: [{ id: "l1", person: "A", dueDate: "2026-09-08", payments: [], principal: 100 }],
    };
    const shared = [{ id: "ss-x", company: "X", openDate: "2026-09-01", closeDate: "2026-09-08" }];
    const alerts = computeAllAlerts(data, shared, today);
    expect(alerts).toHaveLength(3);
    expect(alerts.map(a => a.key).sort()).toEqual(["budget:2083-5", "ipo:ss-x", "loan:l1:2026-09-08"]);
  });

  it("is an empty array when nothing qualifies", () => {
    expect(computeAllAlerts({}, [], "2026-09-07")).toEqual([]);
  });
});
