import { describe, it, expect } from "bun:test";
import { buildCompanyFilings } from "@/lib/fundamentals/periods";
import { tagsUsed } from "@/lib/fundamentals/concepts";
import type { SecCompanyFacts, SecFact, SecSubmissions } from "@/lib/fundamentals/types";

const sub: SecSubmissions = {
  cik: "1", name: "Test Co", sic: "3571",
  filings: { recent: { accessionNumber: ["0000000001-26-000001"], filingDate: ["2026-02-01"], form: ["10-K"], items: [""], primaryDocument: ["doc.htm"] } },
};

const year = (accn: string, filed: string, val: number, fy = 2025): SecFact =>
  ({ start: "2024-07-01", end: "2025-06-30", val, accn, form: "10-K", filed, fy });

const revenueFacts = [year("a-1", "2025-08-01", 1000)];

describe("depreciation and amortization", () => {
  it("adds depreciation and intangible amortization when no combined tag is reported", () => {
    const facts: SecCompanyFacts = {
      cik: 1, entityName: "Test Co",
      facts: { "us-gaap": {
        Revenues: { units: { USD: revenueFacts } },
        Depreciation: { units: { USD: [year("a-1", "2025-08-01", 100)] } },
        AmortizationOfIntangibleAssets: { units: { USD: [year("a-1", "2025-08-01", 40)] } },
      } },
    };
    const da = buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" }).annual[0].items.depreciationAmortization;
    expect(da?.value).toBe(140);
    expect(da?.tag).toBe("Depreciation + AmortizationOfIntangibleAssets");
  });

  it("keeps a combined tag over the sum when both exist", () => {
    const facts: SecCompanyFacts = {
      cik: 1, entityName: "Test Co",
      facts: { "us-gaap": {
        Revenues: { units: { USD: revenueFacts } },
        DepreciationDepletionAndAmortization: { units: { USD: [year("a-1", "2025-08-01", 500)] } },
        Depreciation: { units: { USD: [year("a-1", "2025-08-01", 100)] } },
        AmortizationOfIntangibleAssets: { units: { USD: [year("a-1", "2025-08-01", 40)] } },
      } },
    };
    const da = buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" }).annual[0].items.depreciationAmortization;
    expect(da?.value).toBe(500);
    expect(da?.tag).toBe("DepreciationDepletionAndAmortization");
  });

  it("keeps the filed total when the two rounded parts add up to more (Apple FY2026: 13,423 filed, 8,700 + 4,900 summed)", () => {
    const facts: SecCompanyFacts = {
      cik: 1, entityName: "Test Co",
      facts: { "us-gaap": {
        Revenues: { units: { USD: revenueFacts } },
        DepreciationDepletionAndAmortization: { units: { USD: [year("a-1", "2025-08-01", 134)] } },
        Depreciation: { units: { USD: [year("a-1", "2025-08-01", 87)] } },
        AmortizationOfIntangibleAssets: { units: { USD: [year("a-1", "2025-08-01", 49)] } },
      } },
    };
    const da = buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" }).annual[0].items.depreciationAmortization;
    expect(da?.value).toBe(134);
    expect(da?.tag).toBe("DepreciationDepletionAndAmortization");
  });

  it("does not sum when one of the two parts is missing for that filing", () => {
    const facts: SecCompanyFacts = {
      cik: 1, entityName: "Test Co",
      facts: { "us-gaap": {
        Revenues: { units: { USD: revenueFacts } },
        Depreciation: { units: { USD: [year("a-1", "2025-08-01", 100)] } },
      } },
    };
    const da = buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" }).annual[0].items.depreciationAmortization;
    expect(da?.value).toBe(100);
    expect(da?.tag).toBe("Depreciation");
  });

  it("is listed for the fixture trimmer, with the parts of the sum and the balance-sheet share count", () => {
    const t = tagsUsed();
    expect(t["us-gaap"]).toContain("AmortizationOfIntangibleAssets");
    expect(t["us-gaap"]).toContain("CommonStockSharesOutstanding");
  });
});

describe("combined D&A smaller than its own intangible amortization", () => {
  const build = (combined: number, amort: number) => {
    const facts: SecCompanyFacts = {
      cik: 1, entityName: "Test Co",
      facts: { "us-gaap": {
        Revenues: { units: { USD: revenueFacts } },
        DepreciationDepletionAndAmortization: { units: { USD: [year("a-1", "2025-08-01", combined)] } },
        AmortizationOfIntangibleAssets: { units: { USD: [year("a-1", "2025-08-01", amort)] } },
      } },
    };
    return buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" }).annual[0].items.depreciationAmortization;
  };

  it("adds the amortization, because the filed figure is depreciation alone", () => {
    const da = build(70, 92);
    expect(da?.value).toBe(162);
    expect(da?.tag).toBe("DepreciationDepletionAndAmortization + AmortizationOfIntangibleAssets");
  });

  it("leaves a combined total alone when it already covers the amortization", () => {
    const da = build(200, 92);
    expect(da?.value).toBe(200);
    expect(da?.tag).toBe("DepreciationDepletionAndAmortization");
  });
});

describe("cover-page share count", () => {
  const dei = (rows: Partial<SecFact>[]) => ({
    cik: 1, entityName: "Test Co",
    facts: {
      "us-gaap": { Revenues: { units: { USD: revenueFacts } } },
      dei: { EntityCommonStockSharesOutstanding: { units: { shares: rows.map((r, i) => ({ end: "2026-01-20", val: 0, accn: `a-${i}`, form: "10-K", filed: "2026-02-01", ...r })) } } },
    },
  }) as SecCompanyFacts;

  it("sums every class on the latest filing, and counts each class once", () => {
    const facts = dei([
      { val: 700, accn: "a-2" }, { val: 300, accn: "a-2" }, { val: 50, accn: "a-2" },
    ]);
    const c = buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" });
    expect(c.sharesOutstanding).toEqual({ value: 1050, asOf: "2026-01-20", accn: "a-2", classes: 3 });
  });

  it("does not double count class rows repeated in earlier filings for the same date", () => {
    const facts = dei([
      { val: 700, accn: "a-1", filed: "2026-02-01" },
      { val: 300, accn: "a-1", filed: "2026-02-01" },
      { val: 700, accn: "a-2", filed: "2026-03-01" },
      { val: 300, accn: "a-2", filed: "2026-03-01" },
    ]);
    const c = buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" });
    expect(c.sharesOutstanding).toEqual({ value: 1000, asOf: "2026-01-20", accn: "a-2", classes: 2 });
  });

  it("falls back to the balance-sheet count for a multi-class company with no cover-page total", () => {
    const facts: SecCompanyFacts = {
      cik: 1, entityName: "Alphabet-like",
      facts: {
        "us-gaap": {
          Revenues: { units: { USD: revenueFacts } },
          CommonStockSharesOutstanding: { units: { shares: [
            { end: "2025-12-31", val: 1, accn: "a-1", form: "10-K", filed: "2026-02-01" },
            { end: "2026-01-31", val: 5_800, accn: "b-1", form: "10-Q", filed: "2026-04-25" },
            { end: "2026-01-31", val: 5_900, accn: "b-1", form: "10-Q", filed: "2026-04-25" },
            { end: "2026-01-31", val: 12_000, accn: "b-1", form: "10-Q", filed: "2026-04-25" },
          ] } },
        },
      },
    };
    const c = buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" });
    expect(c.sharesOutstanding).toEqual({ value: 23_700, asOf: "2026-01-31", accn: "b-1", classes: 3 });
  });

  it("prefers the cover-page total over the balance-sheet count when both exist", () => {
    const facts = dei([{ val: 1_000, accn: "a-2" }]);
    facts.facts["us-gaap"].CommonStockSharesOutstanding = { units: { shares: [
      { end: "2026-01-20", val: 9_999, accn: "a-2", form: "10-K", filed: "2026-02-01" },
    ] } };
    const c = buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" });
    expect(c.sharesOutstanding?.value).toBe(1_000);
  });

  it("ignores a cover-page count from years ago, as filers that stopped tagging classes leave behind", () => {
    const facts = dei([{ val: 7_000, end: "2011-04-29", accn: "old-1", filed: "2011-05-01" }]);
    const c = buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" });
    expect(c.sharesOutstanding).toBeNull();
  });

  it("uses the current balance-sheet count when the cover-page count is out of date", () => {
    const facts = dei([{ val: 7_000, end: "2011-04-29", accn: "old-1", filed: "2011-05-01" }]);
    facts.facts["us-gaap"].CommonStockSharesOutstanding = { units: { shares: [
      { end: "2026-01-31", val: 2_000, accn: "b-1", form: "10-Q", filed: "2026-04-25" },
    ] } };
    const c = buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" });
    expect(c.sharesOutstanding?.value).toBe(2_000);
  });

  it("returns a company with no annual periods when the filer has no facts at all", () => {
    const facts = { cik: 1, entityName: "Fund Co" } as unknown as SecCompanyFacts;
    const c = buildCompanyFilings(facts, sub, { ticker: "t", source: "snapshot" });
    expect(c.annual).toEqual([]);
    expect(c.sharesOutstanding).toBeNull();
  });
});

describe("approximate D&A note", () => {
  it("is attached to EBITDA multiples only when D&A is a sum of two tags", async () => {
    const { computeMetrics } = await import("@/lib/fundamentals/metrics");
    const build = (withTotal: boolean) => buildCompanyFilings({
      cik: 1, entityName: "Test Co",
      facts: { "us-gaap": {
        Revenues: { units: { USD: revenueFacts } },
        OperatingIncomeLoss: { units: { USD: [year("a-1", "2025-08-01", 200)] } },
        LongTermDebt: { units: { USD: [{ end: "2025-06-30", val: 300, accn: "a-1", form: "10-K", filed: "2025-08-01", fy: 2025 }] } },
        CashAndCashEquivalentsAtCarryingValue: { units: { USD: [{ end: "2025-06-30", val: 100, accn: "a-1", form: "10-K", filed: "2025-08-01", fy: 2025 }] } },
        Depreciation: { units: { USD: [year("a-1", "2025-08-01", 87)] } },
        AmortizationOfIntangibleAssets: { units: { USD: [year("a-1", "2025-08-01", 49)] } },
        ...(withTotal ? { DepreciationDepletionAndAmortization: { units: { USD: [year("a-1", "2025-08-01", 134)] } } } : {}),
      } },
    }, sub, { ticker: "t", source: "snapshot" });
    expect(computeMetrics(build(false)).netDebtToEbitda.note).toContain("depreciation plus intangible amortization");
    expect(computeMetrics(build(true)).netDebtToEbitda.note ?? "").not.toContain("depreciation plus");
  });
});
