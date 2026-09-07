import { describe, it, expect } from "vitest";
import {
  ipoStatus,
  computeIpoApplicationAmount,
  computeIpoAllotmentResult,
  computeIpoRoiTotals,
  computeIpoRoiTrend,
  computeIpoEfficiencyStats,
} from "./ipoMath.js";

describe("ipoStatus", () => {
  const base = { openDate: "2026-09-05", closeDate: "2026-09-09" };

  it("is Upcoming before the open date", () => {
    expect(ipoStatus(base, "2026-09-01")).toBe("Upcoming");
  });

  it("is Open from the open date through the close date, inclusive", () => {
    expect(ipoStatus(base, "2026-09-05")).toBe("Open");
    expect(ipoStatus(base, "2026-09-07")).toBe("Open");
    expect(ipoStatus(base, "2026-09-09")).toBe("Open");
  });

  it("is Closed the day after the close date", () => {
    expect(ipoStatus(base, "2026-09-10")).toBe("Closed");
  });

  it("is Listed once flagged, regardless of dates", () => {
    expect(ipoStatus({ ...base, listed: true }, "2026-09-01")).toBe("Listed");
    expect(ipoStatus({ ...base, listed: true }, "2026-12-01")).toBe("Listed");
  });
});

describe("computeIpoApplicationAmount", () => {
  it("is units times price per unit", () => {
    expect(computeIpoApplicationAmount(12, 100)).toBe(1200);
  });

  it("is 0 for 0 units", () => {
    expect(computeIpoApplicationAmount(0, 100)).toBe(0);
  });
});

describe("computeIpoAllotmentResult", () => {
  const app = { amountBlocked: 1200, price: 100 };

  it("fully allotted (every unit applied for) owes no refund", () => {
    const result = computeIpoAllotmentResult(app, "allotted", 12);
    expect(result).toEqual({ status: "Allotted", unitsAllotted: 12, refundAmount: 0 });
  });

  it("partially allotted refunds the difference at the IPO's price", () => {
    const result = computeIpoAllotmentResult(app, "allotted", 8);
    expect(result).toEqual({ status: "Allotted", unitsAllotted: 8, refundAmount: 400 });
  });

  it("allotted 0 units refunds the full blocked amount", () => {
    const result = computeIpoAllotmentResult(app, "allotted", 0);
    expect(result).toEqual({ status: "Allotted", unitsAllotted: 0, refundAmount: 1200 });
  });

  it("not allotted always refunds the full blocked amount, regardless of unitsAllotted argument", () => {
    const result = computeIpoAllotmentResult(app, "notallotted", 0);
    expect(result).toEqual({ status: "Not Allotted", unitsAllotted: 0, refundAmount: 1200 });
  });

  it("never returns a negative refund even if units*price would exceed amountBlocked", () => {
    // Shouldn't happen in practice (unitsAllotted is capped at unitsApplied
    // by the caller), but the math itself should still never go negative.
    const result = computeIpoAllotmentResult({ amountBlocked: 500, price: 100 }, "allotted", 10);
    expect(result.refundAmount).toBe(0);
  });
});

describe("computeIpoRoiTotals", () => {
  it("sums blocked amounts across every application", () => {
    const apps = [
      { amountBlocked: 1000, unitsAllotted: null, price: 100, refunded: false, refundAmount: 0 },
      { amountBlocked: 500, unitsAllotted: null, price: 100, refunded: false, refundAmount: 0 },
    ];
    expect(computeIpoRoiTotals(apps).totalApplied).toBe(1500);
  });

  it("only counts allotted value for applications with a known allotment", () => {
    const apps = [
      { amountBlocked: 1200, unitsAllotted: 8, price: 100, refunded: false, refundAmount: 400 },
      { amountBlocked: 500, unitsAllotted: null, price: 100, refunded: false, refundAmount: null }, // still pending — not counted
    ];
    expect(computeIpoRoiTotals(apps).totalAllotted).toBe(800);
  });

  it("only counts refunded amounts once the refund has actually been logged", () => {
    const apps = [
      { amountBlocked: 1200, unitsAllotted: 8, price: 100, refunded: true, refundAmount: 400 },
      { amountBlocked: 1000, unitsAllotted: 0, price: 100, refunded: false, refundAmount: 1000 }, // pending, not counted
    ];
    expect(computeIpoRoiTotals(apps).totalRefunded).toBe(400);
  });

  it("is all zeroes for an empty list", () => {
    expect(computeIpoRoiTotals([])).toEqual({ totalApplied: 0, totalAllotted: 0, totalRefunded: 0 });
  });
});

describe("computeIpoRoiTrend", () => {
  it("groups applications by the BS month they were applied in", () => {
    const apps = [
      { applicationDate: "2026-08-01", amountBlocked: 1000, unitsAllotted: null, price: 100, refunded: false, refundAmount: null },
      { applicationDate: "2026-09-07", amountBlocked: 500, unitsAllotted: null, price: 100, refunded: false, refundAmount: null },
    ];
    const trend = computeIpoRoiTrend(apps);
    expect(trend).toHaveLength(2);
    expect(trend.map(t => t.monthKey)).toEqual(["2083-4", "2083-5"]); // chronological
  });

  it("sums applied/allotted/refunded within the same month", () => {
    const apps = [
      { applicationDate: "2026-09-01", amountBlocked: 1000, unitsAllotted: 8, price: 100, refunded: true, refundAmount: 200 },
      { applicationDate: "2026-09-07", amountBlocked: 500, unitsAllotted: null, price: 100, refunded: false, refundAmount: null },
    ];
    const trend = computeIpoRoiTrend(apps);
    expect(trend).toHaveLength(1);
    expect(trend[0]).toEqual({ monthKey: "2083-5", applied: 1500, allotted: 800, refunded: 200 });
  });

  it("sorts oldest month first", () => {
    const apps = [
      { applicationDate: "2026-09-07", amountBlocked: 100, unitsAllotted: null, price: 100, refunded: false, refundAmount: null },
      { applicationDate: "2026-01-01", amountBlocked: 100, unitsAllotted: null, price: 100, refunded: false, refundAmount: null },
    ];
    const trend = computeIpoRoiTrend(apps);
    expect(trend[0].monthKey < trend[1].monthKey).toBe(true);
  });

  it("is an empty array for no applications", () => {
    expect(computeIpoRoiTrend([])).toEqual([]);
  });
});

describe("computeIpoEfficiencyStats", () => {
  it("counts the full blocked amount for a still-pending application", () => {
    const apps = [{ status: "Applied", amountBlocked: 1000, unitsAllotted: null, refunded: false, refundAmount: null, unitsApplied: 10 }];
    expect(computeIpoEfficiencyStats(apps).blockedLiquidity).toBe(1000);
  });

  it("counts only the unrefunded remainder once a result is known but not yet refunded", () => {
    const apps = [{ status: "Allotted", amountBlocked: 1200, unitsAllotted: 8, price: 100, refunded: false, refundAmount: 400, unitsApplied: 12 }];
    expect(computeIpoEfficiencyStats(apps).blockedLiquidity).toBe(400);
  });

  it("counts nothing as blocked once refunded", () => {
    const apps = [{ status: "Refunded", amountBlocked: 1200, unitsAllotted: 8, price: 100, refunded: true, refundAmount: 400, unitsApplied: 12 }];
    expect(computeIpoEfficiencyStats(apps).blockedLiquidity).toBe(0);
  });

  it("computes a unit-for-unit allotment rate across every decided application", () => {
    const apps = [
      { status: "Allotted", unitsApplied: 10, unitsAllotted: 5, amountBlocked: 1000, refunded: false, refundAmount: 500 },
      { status: "Not Allotted", unitsApplied: 10, unitsAllotted: 0, amountBlocked: 1000, refunded: false, refundAmount: 1000 },
    ];
    // 5 of 20 total units applied for were allotted = 25%.
    expect(computeIpoEfficiencyStats(apps).allotmentRatePct).toBe(25);
  });

  it("is null (not 0) when no application has a known result yet", () => {
    const apps = [{ status: "Applied", unitsApplied: 10, unitsAllotted: null, amountBlocked: 1000, refunded: false, refundAmount: null }];
    expect(computeIpoEfficiencyStats(apps).allotmentRatePct).toBeNull();
  });

  it("averages refund turnaround only across applications actually refunded", () => {
    const apps = [
      { status: "Refunded", applicationDate: "2026-09-01", refundedDate: "2026-09-05", refunded: true, refundAmount: 100, amountBlocked: 100, unitsApplied: 1, unitsAllotted: 0 },
      { status: "Refunded", applicationDate: "2026-09-01", refundedDate: "2026-09-09", refunded: true, refundAmount: 100, amountBlocked: 100, unitsApplied: 1, unitsAllotted: 0 },
      { status: "Not Allotted", applicationDate: "2026-09-01", refundedDate: null, refunded: false, refundAmount: 100, amountBlocked: 100, unitsApplied: 1, unitsAllotted: 0 }, // pending, excluded
    ];
    expect(computeIpoEfficiencyStats(apps).avgRefundDays).toBe(6); // (4 + 8) / 2
  });

  it("is null (not 0) when nothing has been refunded yet", () => {
    const apps = [{ status: "Applied", applicationDate: "2026-09-01", refundedDate: null, refunded: false, refundAmount: null, amountBlocked: 100, unitsApplied: 1, unitsAllotted: null }];
    expect(computeIpoEfficiencyStats(apps).avgRefundDays).toBeNull();
  });

  it("counts applications with a known, unpaid refund as pending", () => {
    const apps = [
      { status: "Allotted", refundAmount: 400, refunded: false, amountBlocked: 1200, unitsApplied: 12, unitsAllotted: 8 },
      { status: "Refunded", refundAmount: 100, refunded: true, amountBlocked: 100, unitsApplied: 1, unitsAllotted: 0 },
      { status: "Allotted", refundAmount: 0, refunded: false, amountBlocked: 1000, unitsApplied: 10, unitsAllotted: 10 }, // fully allotted, nothing pending
    ];
    expect(computeIpoEfficiencyStats(apps).pendingRefundsCount).toBe(1);
  });
});
