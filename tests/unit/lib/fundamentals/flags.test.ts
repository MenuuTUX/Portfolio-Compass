import { describe, it, expect } from "bun:test";
import { computeFlags, FLAG_RULES } from "@/lib/fundamentals/flags";
import type { Filing } from "@/lib/fundamentals/types";
import { fixtureCompany, makeCompany } from "./helpers";

const steady = { revenue: 1000, receivables: 100, netIncome: 100, operatingCashFlow: 150, capex: 50, dilutedShares: 100,
  shareBasedComp: 10, operatingIncome: 150, depreciationAmortization: 50, interestExpense: 10, cash: 100, debtNoncurrent: 200, equity: 500 };
const fiveYears = (f: (i: number) => Partial<typeof steady>) =>
  [2021, 2022, 2023, 2024, 2025].map((fy, i) => ({ fy, items: { ...steady, ...f(i) } }));
const ids = (c: ReturnType<typeof makeCompany>) => computeFlags(c).map((x) => x.id);

describe("computeFlags", () => {
  it("raises nothing for a steady company and for these large real filers", () => {
    expect(ids(makeCompany(fiveYears(() => ({}))))).toEqual([]);
    for (const t of ["AAPL", "MSFT", "NVDA", "JPM"]) expect(computeFlags(fixtureCompany(t))).toEqual([]);
  });

  it("receivables: just above 1.5 times revenue growth for two years, not just below", () => {
    // Revenue +10% a year; receivables +16% (over) or +14% (under).
    const make = (rate: number) => makeCompany(fiveYears((i) => ({ revenue: 1000 * 1.1 ** i, receivables: 100 * (1 + rate) ** i })));
    expect(ids(make(0.16))).toContain("receivables");
    expect(ids(make(0.14))).not.toContain("receivables");
  });

  it("dilution: just above 3% a year, not just below", () => {
    expect(ids(makeCompany(fiveYears((i) => ({ dilutedShares: 100 * 1.031 ** i }))))).toContain("dilution");
    expect(ids(makeCompany(fiveYears((i) => ({ dilutedShares: 100 * 1.029 ** i }))))).not.toContain("dilution");
  });

  it("share-based pay: just above 10% of revenue, not just below", () => {
    expect(ids(makeCompany(fiveYears(() => ({ shareBasedComp: 101 }))))).toContain("share-based-pay");
    expect(ids(makeCompany(fiveYears(() => ({ shareBasedComp: 99 }))))).not.toContain("share-based-pay");
  });

  it("cash burn: three of five years, not two", () => {
    const burn = (n: number) => makeCompany(fiveYears((i) => (i < n ? { capex: 200 } : {})));
    expect(ids(burn(3))).toContain("cash-burn");
    expect(ids(burn(2))).not.toContain("cash-burn");
  });

  it("leverage: net debt above 4 times EBITDA, or coverage below 2", () => {
    expect(ids(makeCompany(fiveYears(() => ({ debtNoncurrent: 901 }))))).toContain("leverage"); // (901-100)/200 > 4
    expect(ids(makeCompany(fiveYears(() => ({ debtNoncurrent: 899 }))))).not.toContain("leverage");
    expect(ids(makeCompany(fiveYears(() => ({ interestExpense: 76 }))))).toContain("leverage"); // 150/76 < 2
  });

  it("skips cash and debt checks for financial companies", () => {
    const bank = makeCompany(fiveYears(() => ({ capex: 200, debtNoncurrent: 5000 })), { sic: 6021 });
    expect(ids(bank)).toEqual([]);
  });

  it("flags a restatement over 5% in the last three years", () => {
    const c = makeCompany(fiveYears(() => ({})));
    const fy = c.annual[3].items.revenue!;
    c.annual[3].items.revenue = { ...fy, restated: { original: fy.value * 0.9, originalAccn: "old" } };
    const flag = computeFlags(c).find((f) => f.id === "restated")!;
    expect(flag.title).toBe("Fiscal 2024 figures were changed later");
    expect(flag.filing!.url).toContain("/Archives/edgar/data/1/");
    c.annual[3].items.revenue = { ...fy, restated: { original: fy.value * 0.97, originalAccn: "old" } };
    expect(ids(c)).not.toContain("restated");
  });

  it("reads 8-K items and late-filing notices from the last three years, with a link", () => {
    const filing = (form: string, filed: string, items: string[] = []): Filing =>
      ({ form, filed, accn: "a", items, url: `https://www.sec.gov/x/${form}` });
    const c = makeCompany(fiveYears(() => ({})), {
      asOf: "2026-10-01",
      filings: [
        filing("8-K", "2025-05-01", ["4.02", "9.01"]),
        filing("8-K", "2024-01-01", ["4.01"]),
        filing("NT 10-K", "2022-01-01"), // older than three years
      ],
    });
    const flags = computeFlags(c);
    expect(flags.map((f) => f.id)).toEqual(["non-reliance", "auditor-change"]);
    expect(flags[0].filing).toEqual({ form: "8-K", filed: "2025-05-01", url: "https://www.sec.gov/x/8-K" });
  });

  it("states every rule plainly, with no em dashes", () => {
    expect(FLAG_RULES.length).toBe(9);
    const all = JSON.stringify(FLAG_RULES) + JSON.stringify(computeFlags(makeCompany(fiveYears((i) => ({ dilutedShares: 100 * 1.1 ** i })))));
    expect(all).not.toContain("—");
  });
});
