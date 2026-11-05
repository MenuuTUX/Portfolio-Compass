import { describe, it, expect } from "bun:test";
import { computeMetrics, computeValuation, splitAdjustedShares, totalDebt } from "@/lib/fundamentals/metrics";
import { fixtureCompany, makeCompany } from "./helpers";

const base = {
  revenue: 1000, grossProfit: 400, operatingIncome: 200, netIncome: 150, pretaxIncome: 190, incomeTax: 40,
  depreciationAmortization: 50, interestExpense: 20, shareBasedComp: 30, operatingCashFlow: 220, capex: 70,
  cash: 100, shortTermInvestments: 50, debtNoncurrent: 300, debtCurrent: 50, commercialPaper: 0, equity: 600, assets: 1500,
  dilutedShares: 100,
};
const years = (overrides: Record<number, Partial<typeof base>> = {}) =>
  [2022, 2023, 2024, 2025].map((fy, i) => ({ fy, items: { ...base, revenue: base.revenue * (1 + 0.1) ** i, ...overrides[fy] } }));

describe("computeMetrics", () => {
  const m = computeMetrics(makeCompany(years()));

  it("computes margins, cash and returns by hand", () => {
    expect(m.fiscalYear).toBe(2025);
    expect(m.revenueGrowth3y.value).toBeCloseTo(0.1, 10);
    expect(m.grossMargin.value).toBeCloseTo(400 / 1331, 10);
    expect(m.operatingMargin.value).toBeCloseTo(200 / 1331, 10);
    expect(m.freeCashFlow.value).toBe(150);
    expect(m.cashConversion.value).toBeCloseTo(1, 10);
    // Tax rate 40/190; invested capital = 350 debt + 600 equity - 150 cash and investments.
    expect(m.returnOnInvestedCapital.value).toBeCloseTo((200 * (1 - 40 / 190)) / 800, 10);
    expect(m.netDebt.value).toBe(200);
    expect(m.netDebtToEbitda.value).toBeCloseTo(200 / 250, 10);
    expect(m.interestCoverage.value).toBeCloseTo(10, 10);
    expect(m.shareBasedCompToRevenue.value).toBeCloseTo(30 / 1331, 10);
    expect(m.dilutionPerYear.value).toBeCloseTo(0, 10);
    expect(m.returnOnEquity.value).toBeNull();
  });

  it("returns a reason instead of a misleading number", () => {
    const loss = computeMetrics(makeCompany(years({ 2025: { netIncome: -10, operatingIncome: -30, depreciationAmortization: 10 } })));
    expect(loss.cashConversion).toEqual({ value: null, reason: "Net income was not positive." });
    expect(loss.netDebtToEbitda).toEqual({ value: null, reason: "EBITDA was not positive." });
    const short = computeMetrics(makeCompany(years().slice(-2)));
    expect(short.revenueGrowth3y.reason).toBe("Fewer than four years of reports.");
    expect(computeMetrics(makeCompany([])).grossMargin.reason).toBe("No annual report found.");
  });

  it("shows bank measures and withholds cash-flow and debt measures for a financial company", () => {
    const bank = computeMetrics(makeCompany(years(), { sic: 6021 }));
    expect(bank.freeCashFlow.value).toBeNull();
    expect(bank.netDebtToEbitda.reason).toMatch(/financial company/);
    expect(bank.returnOnEquity.value).toBeCloseTo(150 / 600, 10);
    expect(bank.equityToAssets.value).toBeCloseTo(600 / 1500, 10);
  });

  it("gives sensible values for real companies", () => {
    const aapl = computeMetrics(fixtureCompany("AAPL"));
    expect(aapl.grossMargin.value!).toBeGreaterThan(0.4);
    expect(aapl.dilutionPerYear.value!).toBeLessThan(0); // buybacks
    const jpm = computeMetrics(fixtureCompany("JPM"));
    expect(jpm.returnOnEquity.value!).toBeGreaterThan(0.05);
  });
});

describe("splitAdjustedShares", () => {
  it("undoes a 10-for-1 split in older years", () => {
    const c = makeCompany([
      { fy: 2022, items: { dilutedShares: 2_500 } },
      { fy: 2023, items: { dilutedShares: 25_070 } },
      { fy: 2024, items: { dilutedShares: 24_940 } },
    ]);
    expect(splitAdjustedShares(c.annual)).toEqual([25_000, 25_070, 24_940]);
  });

  it("leaves ordinary changes alone", () => {
    const c = makeCompany([{ fy: 2024, items: { dilutedShares: 100 } }, { fy: 2025, items: { dilutedShares: 130 } }]);
    expect(splitAdjustedShares(c.annual)).toEqual([100, 130]);
  });

  it("keeps NVIDIA's dilution small despite its 2024 split", () => {
    expect(Math.abs(computeMetrics(fixtureCompany("NVDA")).dilutionPerYear.value!)).toBeLessThan(0.03);
  });
});

describe("totalDebt", () => {
  it("adds the split, or falls back to a combined tag", () => {
    expect(totalDebt(makeCompany([{ fy: 2025, items: { debtNoncurrent: 10, debtCurrent: 2, commercialPaper: 1 } }]).annual[0])).toBe(13);
    expect(totalDebt(makeCompany([{ fy: 2025, items: { debtTotal: 12, commercialPaper: 1 } }]).annual[0])).toBe(13);
    expect(totalDebt(makeCompany([{ fy: 2025, items: { equity: 5 } }]).annual[0])).toBe(0);
  });
});

describe("computeValuation", () => {
  const c = makeCompany(years(), { sharesOutstanding: { value: 100, asOf: "2026-01-31", accn: "x" } });

  it("values the company on trailing figures", () => {
    const v = computeValuation(c, 20);
    expect(v.marketCap.value).toBe(2000);
    expect(v.enterpriseValue.value).toBe(2200);
    expect(v.evToEbitda.value).toBeCloseTo(2200 / 250, 10);
    expect(v.priceToFreeCashFlow.value).toBeCloseTo(2000 / 150, 10);
    expect(v.priceToEarnings.value).toBeCloseTo(2000 / 150, 10);
    expect(v.sharesAsOf).toBe("2026-01-31");
  });

  it("withholds valuation for other currencies, IFRS and missing prices", () => {
    expect(computeValuation({ ...c, currency: "TWD" }, 20).priceToEarnings.value).toBeNull();
    expect(computeValuation(fixtureCompany("TSM"), 300).marketCap.reason).toMatch(/outside US GAAP/);
    expect(computeValuation(c, 0).marketCap.reason).toBe("No current price.");
  });
});
