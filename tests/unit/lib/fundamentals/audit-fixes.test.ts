import { describe, it, expect } from "bun:test";
import { buildCompanyFilings, parseFilings } from "@/lib/fundamentals/periods";
import { CONCEPTS } from "@/lib/fundamentals/concepts";
import { computeMetrics, computeValuation, splitAdjustedShares, totalDebt } from "@/lib/fundamentals/metrics";
import type { FactValue, LineItem, SecCompanyFacts, SecFact, SecSubmissions } from "@/lib/fundamentals/types";
import { fixtureCompany, makeCompany } from "./helpers";

const flow = (start: string, end: string, val: number, form: string, filed: string, extra: Partial<SecFact> = {}): SecFact =>
  ({ start, end, val, form, filed, accn: `a-${filed}-${form}`, ...extra });
const inst = (end: string, val: number, form: string, filed: string): SecFact =>
  ({ end, val, form, filed, accn: `a-${filed}-${form}` });
const tagged = (tag: string, value: number): FactValue =>
  ({ value, tag, unit: "USD", accn: "a", form: "10-K", filed: "2026-02-01" });
const period = (items: Partial<Record<LineItem, FactValue>>) => ({ items });
/** Warnings about share counts only, so tests of splits are not tripped by unrelated data gaps. */
const shareWarnings = (w: string[]) => w.filter((x) => /share/i.test(x));

const filingRows = (rows: { form: string; filed: string; items?: string }[]): SecSubmissions => ({
  cik: "1", name: "Test Co", sic: "3571",
  filings: { recent: {
    accessionNumber: rows.map((_, i) => `0000000001-26-${String(i + 1).padStart(6, "0")}`),
    filingDate: rows.map((r) => r.filed),
    form: rows.map((r) => r.form),
    items: rows.map((r) => r.items ?? ""),
    primaryDocument: rows.map(() => "doc.htm"),
  } },
});

const usd = (tags: Record<string, SecFact[]>) => Object.fromEntries(Object.entries(tags).map(([t, list]) => [t, { units: { USD: list } }]));
const companyFacts = (
  us: Record<string, SecFact[]>,
  extra: { ifrs?: Record<string, SecFact[]>; dei?: SecFact[] } = {},
): SecCompanyFacts => ({
  cik: 1, entityName: "Test Co",
  facts: {
    ...(Object.keys(us).length ? { "us-gaap": usd(us) } : {}),
    ...(extra.ifrs ? { "ifrs-full": usd(extra.ifrs) } : {}),
    ...(extra.dei ? { dei: { EntityCommonStockSharesOutstanding: { units: { shares: extra.dei } } } } : {}),
  },
});

describe("P5 filings list and payload", () => {
  it("keeps only the forms the app reads and 8-Ks with items 4.01 or 4.02", () => {
    const out = parseFilings(filingRows([
      { form: "10-K", filed: "2026-02-01" },
      { form: "10-Q", filed: "2026-05-01" },
      { form: "DEF 14A", filed: "2026-03-01" },
      { form: "8-K", filed: "2026-04-01", items: "2.02,9.01" },
      { form: "8-K", filed: "2026-04-02", items: "4.02,9.01" },
      { form: "8-K", filed: "2026-04-03", items: "4.01" },
      { form: "NT 10-K", filed: "2026-03-02" },
      { form: "NT 10-Q", filed: "2026-05-02" },
      { form: "10-K405", filed: "2001-03-02" },
      { form: "4", filed: "2026-04-05" },
    ]), 1);
    expect(out.map((f) => f.form)).toEqual(["10-K", "10-Q", "8-K", "8-K", "NT 10-K", "NT 10-Q", "10-K405"]);
    expect(out[2].items).toEqual(["4.02", "9.01"]);
    expect(out[0].url).toMatch(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1\/000000000126000001\//);
  });

  it("keeps the AAPL output under 40 KB", () => {
    expect(JSON.stringify(fixtureCompany("AAPL")).length).toBeLessThan(40_000);
  });
});

describe("P6 staleness", () => {
  it("flags TSM, whose 20-F for 2025 was filed but data stops at 2024", () => {
    const tsm = fixtureCompany("TSM");
    expect(tsm.staleness.annualStale).toBe(true);
    expect(tsm.staleness.annualMonths!).toBeGreaterThan(15);
  });

  it("does not flag AAPL, which is current", () => {
    const aapl = fixtureCompany("AAPL");
    expect(aapl.staleness.annualStale).toBe(false);
    expect(aapl.staleness.trailingStale).toBe(false);
  });

  it("flags a trailing period older than six months but not an annual one of the same age", () => {
    const c = buildCompanyFilings(companyFacts({
      Revenues: [flow("2025-01-01", "2025-12-31", 100, "10-K", "2026-02-01")],
    }), filingRows([{ form: "10-K", filed: "2026-02-01" }, { form: "10-Q", filed: "2026-08-01" }]), { ticker: "T", source: "snapshot" });
    expect(c.staleness.annualMonths).toBe(7);
    expect(c.staleness.annualStale).toBe(false);
    // With no quarter after the last fiscal year, the trailing period is that annual end: seven months old.
    expect(c.staleness.trailingStale).toBe(true);
  });
});

describe("P8 taxonomy chosen per fiscal year", () => {
  it("keeps the older GAAP years and the newer IFRS years of a filer that switched", () => {
    const c = buildCompanyFilings(companyFacts(
      { Revenues: [flow("2022-01-01", "2022-12-31", 10, "10-K", "2023-02-01"), flow("2023-01-01", "2023-12-31", 11, "10-K", "2024-02-01")] },
      { ifrs: { Revenue: [flow("2024-01-01", "2024-12-31", 12, "20-F", "2025-03-01"), flow("2025-01-01", "2025-12-31", 13, "20-F", "2026-03-01")] } },
    ), filingRows([]), { ticker: "T", source: "snapshot" });
    expect(c.annual.map((p) => p.fiscalYear)).toEqual([2022, 2023, 2024, 2025]);
    expect(c.annual.map((p) => p.items.revenue!.value)).toEqual([10, 11, 12, 13]);
    expect(c.taxonomy).toBe("ifrs-full");
  });
});

describe("P10 fiscal year labels", () => {
  it("labels a 53-week year ending Jan 1 2022 as 2021, so it cannot clash with 2022", () => {
    const c = buildCompanyFilings(companyFacts({
      Revenues: [
        flow("2019-12-29", "2020-12-26", 10, "10-K", "2021-02-15", { fy: 2020 }),
        flow("2020-12-27", "2022-01-01", 11, "10-K", "2022-02-15", { fy: 2021 }),
        flow("2022-01-02", "2022-12-31", 12, "10-K", "2023-02-15", { fy: 2022 }),
      ],
    }), filingRows([]), { ticker: "T", source: "snapshot" });
    expect(c.annual.map((p) => p.fiscalYear)).toEqual([2020, 2021, 2022]);
    expect(new Set(c.annual.map((p) => p.fiscalYear)).size).toBe(c.annual.length);
  });

  it("uses the fy of the filing that first reported the period, not a later comparative", () => {
    // A later 10-K repeats the old year with fy 2026; the label must stay 2024.
    const c = buildCompanyFilings(companyFacts({
      Revenues: [
        flow("2023-10-01", "2024-09-28", 10, "10-K", "2024-11-01", { fy: 2024 }),
        flow("2023-10-01", "2024-09-28", 10, "10-K", "2026-11-01", { fy: 2026 }),
      ],
    }), filingRows([]), { ticker: "T", source: "snapshot" });
    expect(c.annual[0].fiscalYear).toBe(2024);
  });

  it("falls back to the year holding most of the period when fy is missing, so the 53-week year is 2021", () => {
    // Justified change: the earlier fallback (end year) labelled a year ending 1 Jan 2022 as 2022, the same as the next year.
    const c = buildCompanyFilings(companyFacts({
      Revenues: [
        flow("2020-12-27", "2022-01-01", 11, "10-K", "2022-02-15"),
        flow("2022-01-02", "2022-12-31", 12, "10-K", "2023-02-15"),
      ],
    }), filingRows([]), { ticker: "T", source: "snapshot" });
    expect(c.annual.map((p) => p.fiscalYear)).toEqual([2021, 2022]);
  });
});

describe("P20 annual form list", () => {
  it("reads a 10-K405 as an annual report", () => {
    const c = buildCompanyFilings(companyFacts({
      Revenues: [flow("2000-01-01", "2000-12-31", 5, "10-K405", "2001-03-01", { fy: 2000 })],
    }), filingRows([]), { ticker: "T", source: "snapshot" });
    expect(c.annual.map((p) => p.items.revenue?.value)).toEqual([5]);
  });
});

describe("P2 one balance-sheet date", () => {
  it("never borrows a balance item from another date", () => {
    const c = buildCompanyFilings(companyFacts({
      Revenues: [
        flow("2025-01-01", "2025-12-31", 100, "10-K", "2026-02-01", { fy: 2025 }),
        flow("2025-01-01", "2025-03-31", 20, "10-Q", "2025-05-01", { fy: 2025 }),
        flow("2026-01-01", "2026-03-31", 25, "10-Q", "2026-05-01", { fy: 2026 }),
      ],
      Assets: [inst("2025-12-31", 1000, "10-K", "2026-02-01"), inst("2026-03-31", 1100, "10-Q", "2026-05-01")],
      CashAndCashEquivalentsAtCarryingValue: [inst("2025-12-31", 100, "10-K", "2026-02-01"), inst("2026-03-31", 120, "10-Q", "2026-05-01")],
      LongTermDebtNoncurrent: [inst("2025-12-31", 300, "10-K", "2026-02-01")],
      LongTermDebtCurrent: [inst("2026-03-31", 50, "10-Q", "2026-05-01")],
    }), filingRows([{ form: "10-Q", filed: "2026-05-01" }]), { ticker: "T", source: "snapshot" });
    const t = c.trailing!;
    expect(t.balanceSheetDate).toBe("2026-03-31");
    expect(t.items.cash!.value).toBe(120);
    expect(t.items.debtCurrent!.value).toBe(50);
    expect(t.items.debtNoncurrent).toBeUndefined();
    expect(totalDebt(t)).toBe(50);
  });

  it("takes the balance date from the latest instant that has assets or cash", () => {
    const c = buildCompanyFilings(companyFacts({
      Revenues: [flow("2025-01-01", "2025-12-31", 100, "10-K", "2026-02-01", { fy: 2025 })],
      Assets: [inst("2025-12-31", 1000, "10-K", "2026-02-01")],
      LongTermDebtNoncurrent: [inst("2026-03-31", 300, "10-Q", "2026-05-01")],
    }), filingRows([]), { ticker: "T", source: "snapshot" });
    expect(c.trailing!.balanceSheetDate).toBe("2025-12-31");
    expect(c.trailing!.items.debtNoncurrent).toBeUndefined();
  });
});

describe("P13 share classes", () => {
  it("keeps two classes that report the same count, and counts them", () => {
    const c = buildCompanyFilings(companyFacts({
      Revenues: [flow("2025-01-01", "2025-12-31", 100, "10-K", "2026-02-01", { fy: 2025 })],
    }, {
      dei: [
        { end: "2026-01-20", val: 500, accn: "a-2", form: "10-K", filed: "2026-02-01" },
        { end: "2026-01-20", val: 500, accn: "a-2", form: "10-K", filed: "2026-02-01" },
      ].map((f) => ({ ...f, accn: "a-2" })) as SecFact[],
    }), filingRows([]), { ticker: "T", source: "snapshot" });
    expect(c.sharesOutstanding).toEqual({ value: 1000, asOf: "2026-01-20", accn: "a-2", classes: 2 });
  });

  it("reports one class for a single entry", () => {
    const c = fixtureCompany("AAPL");
    expect(c.sharesOutstanding!.classes).toBe(1);
  });
});

describe("P16 depreciation and amortization candidates", () => {
  it("prefers the larger D&A tag when two cover the same year", () => {
    const c = buildCompanyFilings(companyFacts({
      Revenues: [flow("2025-07-01", "2026-06-30", 100, "10-K", "2026-08-01", { fy: 2026 })],
      Depreciation: [flow("2025-07-01", "2026-06-30", 34_300, "10-K", "2026-08-01", { fy: 2026 })],
      DepreciationAmortizationAndOther: [flow("2025-07-01", "2026-06-30", 38_000, "10-K", "2026-08-01", { fy: 2026 })],
    }), filingRows([]), { ticker: "T", source: "snapshot" });
    expect(c.annual[0].items.depreciationAmortization!.value).toBe(38_000);
    expect(c.annual[0].items.depreciationAmortization!.tag).toBe("DepreciationAmortizationAndOther");
  });
});

describe("P3 debt tags", () => {
  it("reads a line of credit, notes payable and borrowings as debt", () => {
    expect(CONCEPTS.debtNoncurrent.usGaap).toContain("LongTermLineOfCredit");
    expect(CONCEPTS.debtCurrent.usGaap).toContain("ShortTermBorrowings");
    expect(CONCEPTS.debtCurrent.usGaap).toContain("LongTermDebtAndCapitalLeaseObligationsCurrent");
    // Gross notes are totals (current portion included), so they sit with debtTotal, not beside the noncurrent split.
    expect(CONCEPTS.debtTotal.usGaap).toContain("NotesPayable");
    expect(CONCEPTS.debtTotal.usGaap).toContain("ConvertibleNotesPayable");
    expect(CONCEPTS.debtNoncurrent.usGaap).not.toContain("ConvertibleNotesPayable");
  });

  it("does not add commercial paper on top of a DebtCurrent figure, which already includes it", () => {
    expect(totalDebt(period({
      debtNoncurrent: tagged("LongTermDebtNoncurrent", 10),
      debtCurrent: tagged("DebtCurrent", 2),
      commercialPaper: tagged("CommercialPaper", 1),
    }))).toBe(12);
  });

  it("adds commercial paper when the current portion is only the maturities", () => {
    expect(totalDebt(period({
      debtNoncurrent: tagged("LongTermDebtNoncurrent", 10),
      debtCurrent: tagged("LongTermDebtCurrent", 2),
      commercialPaper: tagged("CommercialPaper", 1),
    }))).toBe(13);
  });

  it("returns unknown, not zero, when no debt tag exists", () => {
    expect(totalDebt(period({ equity: tagged("StockholdersEquity", 5) }))).toBeUndefined();
  });
});

describe("P12 split detection", () => {
  const shares = (raw: number[]) => makeCompany(raw.map((v, i) => ({ fy: 2022 + i, items: { dilutedShares: v } }))).annual;

  it("recognises a 3-for-2 split", () => {
    expect(splitAdjustedShares(shares([100, 150, 152]))).toEqual([150, 150, 152]);
  });

  it("does not adjust away a real 1.98x issuance that keeps moving afterwards", () => {
    expect(splitAdjustedShares(shares([100, 198, 215]))).toEqual([100, 198, 215]);
  });

  it("recognises a 10-for-1 split", () => {
    expect(splitAdjustedShares(shares([2_500, 25_070, 24_940]))).toEqual([25_000, 25_070, 24_940]);
  });

  it("does not treat 1.9x or 2.1x as a split", () => {
    expect(splitAdjustedShares(shares([100, 190, 190]))).toEqual([100, 190, 190]);
    expect(splitAdjustedShares(shares([100, 210, 210]))).toEqual([100, 210, 210]);
  });
});

describe("P1 market cap after splits", () => {
  // NVIDIA's cover page showed 2.46 billion shares in May 2024; the 10-for-1 split followed in June.
  const nvda = fixtureCompany("NVDA");
  const preSplit = { ...nvda, sharesOutstanding: { value: 2_460_000_000, asOf: "2024-05-17", accn: "x", classes: 1 } };

  it("multiplies a pre-split cover count by splits dated after it", () => {
    const v = computeValuation(preSplit, 100, { splits: [{ date: "2024-06-10", ratio: 10 }] });
    expect(v.marketCap.value).toBe(2.46e12);
    expect(shareWarnings(v.warnings)).toEqual([]);
  });

  it("ignores splits dated before the cover date and warns", () => {
    const v = computeValuation(preSplit, 100, { splits: [{ date: "2024-01-10", ratio: 10 }] });
    expect(v.marketCap.value).toBe(2.46e11);
    expect(v.warnings.join(" ")).toMatch(/no split explains it/);
  });

  it("warns when cover shares and diluted shares disagree and nothing explains it", () => {
    expect(computeValuation(preSplit, 100).warnings.join(" ")).toMatch(/more than 1\.5x/);
  });

  it("is quiet about share counts for the current, already-consistent NVIDIA filing", () => {
    expect(shareWarnings(computeValuation(nvda, 100).warnings)).toEqual([]);
  });
});

describe("P13 valuation warning for several classes", () => {
  it("keeps the sum and warns that per-share values are approximate", () => {
    const c = makeCompany([{ fy: 2025, items: { dilutedShares: 1000, netIncome: 100, operatingIncome: 100, depreciationAmortization: 10 } }],
      { sharesOutstanding: { value: 1000, asOf: "2026-01-31", accn: "x", classes: 2 } });
    const v = computeValuation(c, 10);
    expect(v.marketCap.value).toBe(10_000);
    expect(v.warnings).toContain("Multiple share classes; per-share values are approximate");
  });
});

describe("P3 debt in metrics and valuation", () => {
  const noDebt = makeCompany([{ fy: 2025, items: { revenue: 1000, operatingIncome: 200, depreciationAmortization: 50, netIncome: 150, operatingCashFlow: 220, capex: 70, cash: 100, equity: 600, assets: 1500, dilutedShares: 100 } }]);

  it("reports debt as unknown and warns, instead of netting cash alone", () => {
    const m = computeMetrics(noDebt);
    expect(m.totalDebt.value).toBeNull();
    expect(m.netDebt.value).toBeNull();
    expect(m.warnings).toContain("No debt figures found in this filing");
  });

  it("withholds enterprise value for the same filing", () => {
    const v = computeValuation(noDebt, 10);
    expect(v.enterpriseValue.value).toBeNull();
    expect(v.warnings).toContain("No debt figures found in this filing");
  });
});

describe("P17 returns on average capital", () => {
  const base = {
    revenue: 1000, grossProfit: 400, operatingIncome: 200, netIncome: 150, pretaxIncome: 190, incomeTax: 40,
    depreciationAmortization: 50, interestExpense: 20, shareBasedComp: 30, operatingCashFlow: 220, capex: 70,
    cash: 100, shortTermInvestments: 50, debtNoncurrent: 300, debtCurrent: 50, commercialPaper: 0, equity: 600, assets: 1500,
    dilutedShares: 100,
  };

  it("uses the average of opening and closing invested capital", () => {
    const c = makeCompany([
      { fy: 2024, items: { ...base, equity: 600 } },
      { fy: 2025, items: { ...base, equity: 800 } },
    ]);
    // Invested capital: 350 + 600 - 150 = 800 opening, 350 + 800 - 150 = 1000 closing.
    expect(computeMetrics(c).returnOnInvestedCapital.value).toBeCloseTo((200 * (1 - 40 / 190)) / 900, 10);
  });

  it("uses net income to common over average common equity, excluding preferred", () => {
    const items = { ...base, equity: 600, preferredEquity: 100, netIncomeToCommon: 140 };
    const c = makeCompany([{ fy: 2024, items }, { fy: 2025, items }], { sic: 6021 });
    // Common equity 500 in both years; 140 / 500 rather than 150 / 600.
    expect(computeMetrics(c).returnOnEquity.value).toBeCloseTo(140 / 500, 10);
  });
});

describe("P18 free cash flow and finance leases", () => {
  const base = { revenue: 1000, operatingIncome: 200, netIncome: 150, operatingCashFlow: 220, capex: 70, equity: 600, assets: 1500, cash: 100, debtNoncurrent: 300, dilutedShares: 100 };

  it("subtracts finance lease principal payments when present, and says so", () => {
    const m = computeMetrics(makeCompany([{ fy: 2025, items: { ...base, financeLeasePayments: 20 } }]));
    expect(m.freeCashFlow.value).toBe(130);
    expect(m.freeCashFlow.note).toMatch(/finance lease/);
  });

  it("leaves free cash flow alone, with no note, when no lease payments are reported", () => {
    const m = computeMetrics(makeCompany([{ fy: 2025, items: base }]));
    expect(m.freeCashFlow.value).toBe(150);
    expect(m.freeCashFlow.note).toBeUndefined();
  });
});

describe("fiscal labels and balance-sheet gaps (review)", () => {
  it("labels TSM's last annual period 2024, the year it ends in", () => {
    const tsm = fixtureCompany("TSM");
    expect(tsm.annual[tsm.annual.length - 1].fiscalYear).toBe(2024);
  });

  it("keeps every fixture label within one year of the period end", () => {
    for (const t of ["AAPL", "MSFT", "NVDA", "JPM", "TSM"]) {
      for (const p of fixtureCompany(t).annual) {
        expect(Math.abs(p.fiscalYear - Number(p.end.slice(0, 4)))).toBeLessThanOrEqual(1);
      }
    }
  });

  it("labels an IPO's older years by their own years, not by its first 10-K's fy", () => {
    const c = buildCompanyFilings(companyFacts({
      Revenues: [
        flow("2018-01-01", "2018-12-31", 1, "10-K", "2021-03-01", { fy: 2020 }),
        flow("2019-01-01", "2019-12-31", 2, "10-K", "2021-03-01", { fy: 2020 }),
        flow("2020-01-01", "2020-12-31", 3, "10-K", "2021-03-01", { fy: 2020 }),
      ],
    }), filingRows([]), { ticker: "T", source: "snapshot" });
    expect(c.annual.map((p) => p.fiscalYear)).toEqual([2018, 2019, 2020]);
  });

  it("keeps 8-K/A amendments that carry item 4.02, since flags.ts reads every 8-K form", () => {
    const [f] = parseFilings(filingRows([{ form: "8-K/A", filed: "2026-04-01", items: "4.02" }]), 1);
    expect(f.form).toBe("8-K/A");
  });

  it("names the balance items missing on the balance-sheet date, and warns when it is short-term investments", () => {
    const nvda = fixtureCompany("NVDA");
    expect(nvda.trailing!.balanceSheetDate).toBe("2026-07-26");
    expect(nvda.trailing!.missingOnBalanceDate).toContain("shortTermInvestments");
    expect(nvda.trailing!.items.shortTermInvestments).toBeUndefined();
    expect(computeValuation(nvda, 100).warnings.join(" ")).toMatch(/Short-term investments are not reported/);
  });
});
