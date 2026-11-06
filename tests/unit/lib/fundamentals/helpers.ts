import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCompanyFilings, monthsBetween } from "@/lib/fundamentals/periods";
import type { AnnualPeriod, CompanyFilings, FactValue, LineItem, SecCompanyFacts, SecSubmissions } from "@/lib/fundamentals/types";

const FIXTURES = join(import.meta.dir, "../../../fixtures/sec");

export function loadFixture(ticker: string): { facts: SecCompanyFacts; sub: SecSubmissions } {
  const t = ticker.toLowerCase();
  return {
    facts: JSON.parse(readFileSync(join(FIXTURES, `${t}-facts.json`), "utf8")),
    sub: JSON.parse(readFileSync(join(FIXTURES, `${t}-submissions.json`), "utf8")),
  };
}

export function fixtureCompany(ticker: string): CompanyFilings {
  const { facts, sub } = loadFixture(ticker);
  return buildCompanyFilings(facts, sub, { ticker, source: "edgar-live" });
}

const fact = (value: number): FactValue => ({ value, tag: "Test", unit: "USD", accn: "0000000000-26-000001", form: "10-K", filed: "2026-02-01" });

/** A synthetic company with whole-year periods ending Dec 31. */
export function makeCompany(
  years: { fy: number; items: Partial<Record<LineItem, number>> }[],
  overrides: Partial<CompanyFilings> = {},
): CompanyFilings {
  const annual: AnnualPeriod[] = years.map(({ fy, items }) => ({
    fiscalYear: fy,
    start: `${fy}-01-01`,
    end: `${fy}-12-31`,
    items: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, fact(v as number)])),
  }));
  const last = annual[annual.length - 1];
  const company: CompanyFilings = {
    cik: 1, ticker: "TEST", name: "Test Co", sic: 3571, taxonomy: "us-gaap", currency: "USD",
    annual,
    trailing: last ? { end: last.end, basis: "annual", balanceSheetDate: last.end, missingOnBalanceDate: [], items: last.items } : null,
    sharesOutstanding: { value: 1_000, asOf: "2026-01-31", accn: "x", classes: 1 },
    filings: [],
    asOf: "2026-03-01",
    staleness: { annualMonths: null, annualStale: false, trailingMonths: null, trailingStale: false },
    source: "edgar-live",
    ...overrides,
  };
  const annualMonths = last ? monthsBetween(last.end, company.asOf) : null;
  company.staleness = {
    annualMonths,
    annualStale: annualMonths !== null && annualMonths > 15,
    trailingMonths: annualMonths,
    trailingStale: annualMonths !== null && annualMonths > 6,
  };
  return company;
}
