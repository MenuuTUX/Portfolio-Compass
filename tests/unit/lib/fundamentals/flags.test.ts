import { describe, it, expect } from "bun:test";
import { computeFlags, FLAG_CHECKS, FLAG_RULES } from "@/lib/fundamentals/flags";
import type { Filing } from "@/lib/fundamentals/types";
import { fixtureCompany, makeCompany } from "./helpers";

const steady = { revenue: 1000, receivables: 100, netIncome: 100, operatingCashFlow: 150, capex: 50, dilutedShares: 100,
  shareBasedComp: 10, operatingIncome: 150, depreciationAmortization: 50, interestExpense: 10, cash: 100, debtNoncurrent: 200, equity: 500 };
const fiveYears = (f: (i: number) => Partial<typeof steady>) =>
  [2021, 2022, 2023, 2024, 2025].map((fy, i) => ({ fy, items: { ...steady, ...f(i) } }));
const ids = (c: ReturnType<typeof makeCompany>) => computeFlags(c).map((x) => x.id);
const VERDICT_WORDS = /heavy|danger|weak|red flag|healthy|strong|poor|bad|good|concern|risk|buy|sell/i;

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

  it("does not report interest coverage for a loss-making company with net cash (no -10.0 times)", () => {
    // Operating loss of 50, EBITDA 0, interest 5, debt 100 against cash of 300.
    const c = makeCompany(fiveYears(() => ({ operatingIncome: -50, interestExpense: 5, debtNoncurrent: 100, cash: 300 })));
    expect(ids(c)).not.toContain("leverage");
    expect(JSON.stringify(computeFlags(c))).not.toContain("-10");
  });

  it("states a utility-like profile as facts, without verdict words", () => {
    // Capex 250 against operating cash flow 150 for five years; EBITDA 200; debt 1000 less cash 100 = net debt 900 = 4.5 times EBITDA.
    const c = makeCompany(fiveYears(() => ({ capex: 250, debtNoncurrent: 1000, interestExpense: 10 })));
    const flags = computeFlags(c);
    const leverage = flags.find((f) => f.id === "leverage")!;
    expect(leverage.detail).toContain("Net debt is 4.5 times EBITDA.");
    expect(flags.find((f) => f.id === "cash-burn")!.title).toBe("Free cash flow negative in 5 of the last 5 years");
    for (const f of flags) expect(`${f.title} ${f.detail}`).not.toMatch(VERDICT_WORDS);
    expect(flags.map((f) => f.title)).not.toContain("Profits on paper, but cash going out");
  });

  it("skips cash and debt checks for financial companies", () => {
    const bank = makeCompany(fiveYears(() => ({ capex: 200, debtNoncurrent: 5000 })), { sic: 6021 });
    expect(ids(bank)).toEqual([]);
  });

  it("keeps leverage and cash checks for REITs, which are not financial companies", () => {
    const reit = makeCompany(fiveYears(() => ({ capex: 200, debtNoncurrent: 901 })), { sic: 6798 });
    expect(ids(reit)).toEqual(expect.arrayContaining(["cash-burn", "leverage"]));
  });

  it("keeps the same checks for operating real estate (SIC 6531)", () => {
    const reit = makeCompany(fiveYears(() => ({ debtNoncurrent: 901 })), { sic: 6531 });
    expect(ids(reit)).toContain("leverage");
  });

  it("flags a restatement over 5% in the last three years, with a neutral title", () => {
    const c = makeCompany(fiveYears(() => ({})));
    const fy = c.annual[3].items.revenue!;
    c.annual[3].items.revenue = { ...fy, restated: { original: fy.value * 0.9, originalAccn: "old" } };
    const flag = computeFlags(c).find((f) => f.id === "restated")!;
    expect(flag.title).toBe("Fiscal 2024 figures were changed in a later filing");
    expect(flag.detail).not.toContain("Possible restatement");
    expect(flag.filing!.url).toContain("/Archives/edgar/data/1/");
    c.annual[3].items.revenue = { ...fy, restated: { original: fy.value * 0.97, originalAccn: "old" } };
    expect(ids(c)).not.toContain("restated");
  });

  it("calls a restatement possible only when an 8-K Item 4.02 is in the same window", () => {
    const c = makeCompany(fiveYears(() => ({})), {
      asOf: "2026-10-01",
      filings: [{ form: "8-K", filed: "2025-05-01", accn: "a", items: ["4.02"], url: "https://www.sec.gov/x/4.02" }],
    });
    const fy = c.annual[3].items.revenue!;
    c.annual[3].items.revenue = { ...fy, restated: { original: fy.value * 0.9, originalAccn: "old" } };
    expect(computeFlags(c).find((f) => f.id === "restated")!.detail).toContain("Possible restatement");
    c.filings = [];
    expect(computeFlags(c).find((f) => f.id === "restated")!.detail).not.toContain("Possible restatement");
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

  it("uses one threshold table for both the checks and the numbers in the text", () => {
    expect(FLAG_RULES.netDebtMaxMultipleOfEbitda).toBe(4);
    expect(FLAG_RULES.interestCoverageMin).toBe(2);
    const leverage = FLAG_CHECKS.find((r) => r.id === "leverage")!;
    expect(leverage.rule).toContain(`${FLAG_RULES.netDebtMaxMultipleOfEbitda} times EBITDA`);
    expect(leverage.rule).toContain(`${FLAG_RULES.interestCoverageMin} times`);
  });

  it("states every check plainly, with no em dashes or verdict words", () => {
    expect(FLAG_CHECKS.length).toBe(9);
    const all = JSON.stringify(FLAG_CHECKS) + JSON.stringify(computeFlags(makeCompany(fiveYears((i) => ({ dilutedShares: 100 * 1.1 ** i })))));
    expect(all).not.toContain("—");
    expect(all).not.toMatch(VERDICT_WORDS);
  });
});
