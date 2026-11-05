import { isFinancialSic } from "./sector";
import type { AnnualPeriod, CompanyFilings, FactValue, LineItem } from "./types";

/** A computed measure, or null with the reason it could not be computed. */
export type Measure = { value: number; reason?: undefined } | { value: null; reason: string };

const ok = (value: number): Measure => (Number.isFinite(value) ? { value } : { value: null, reason: "Not a finite number." });
const missing = (reason: string): Measure => ({ value: null, reason });

const v = (p: { items: Partial<Record<LineItem, FactValue>> } | null | undefined, item: LineItem) =>
  p?.items[item]?.value;

/** Total debt: long-term + current portion + commercial paper, or a combined total tag when the split is missing. */
export function totalDebt(p: { items: Partial<Record<LineItem, FactValue>> } | null | undefined): number | undefined {
  if (!p) return undefined;
  const nonCurrent = v(p, "debtNoncurrent");
  const cp = v(p, "commercialPaper") ?? 0;
  if (nonCurrent !== undefined) return nonCurrent + (v(p, "debtCurrent") ?? 0) + cp;
  const total = v(p, "debtTotal");
  if (total !== undefined) return total + cp;
  // No debt tags at all usually means no debt.
  return v(p, "equity") !== undefined ? cp : undefined;
}

/**
 * Diluted share counts adjusted for splits. Later filings restate recent years
 * for a split, but older years keep the pre-split count, so a jump close to a
 * whole ratio (2:1, 4:1, 10:1, or the reverse) between adjacent years is a split.
 */
export function splitAdjustedShares(annual: AnnualPeriod[]): (number | undefined)[] {
  const raw = annual.map((p) => v(p, "dilutedShares"));
  const out = [...raw];
  let factor = 1;
  for (let i = out.length - 1; i > 0; i--) {
    const newer = raw[i];
    const older = raw[i - 1];
    if (newer && older) {
      const ratio = newer / older;
      const whole = ratio >= 1 ? Math.round(ratio) : 1 / Math.round(1 / ratio);
      const isSplit = (ratio >= 1.8 || ratio <= 0.55) && Math.abs(ratio / whole - 1) < 0.06;
      if (isSplit) factor *= whole;
    }
    if (older !== undefined) out[i - 1] = older * factor;
  }
  return out;
}

/** Cash plus short-term investments, which analysts net against debt. */
export function liquidAssets(p: { items: Partial<Record<LineItem, FactValue>> } | null | undefined): number | undefined {
  const cash = v(p, "cash");
  return cash === undefined ? undefined : cash + (v(p, "shortTermInvestments") ?? 0);
}

const cagr = (from: number, to: number, years: number) => Math.pow(to / from, 1 / years) - 1;

export interface CompanyMetrics {
  fiscalYear: number | null;
  revenueGrowth3y: Measure;
  grossMargin: Measure;
  operatingMargin: Measure;
  freeCashFlow: Measure;
  /** Free cash flow divided by net income. */
  cashConversion: Measure;
  returnOnInvestedCapital: Measure;
  netDebt: Measure;
  netDebtToEbitda: Measure;
  interestCoverage: Measure;
  shareBasedCompToRevenue: Measure;
  /** Diluted share count change a year over three years; negative means buybacks. */
  dilutionPerYear: Measure;
  /** Financial companies only. */
  returnOnEquity: Measure;
  equityToAssets: Measure;
}

const FINANCIAL_ONLY = "Shown for financial companies only.";
const NOT_FOR_FINANCIALS = "Not meaningful for a financial company.";

export function computeMetrics(c: CompanyFilings): CompanyMetrics {
  const years = c.annual;
  const last = years[years.length - 1];
  const financial = isFinancialSic(c.sic);
  const none = missing("No annual report found.");
  if (!last) {
    return {
      fiscalYear: null, revenueGrowth3y: none, grossMargin: none, operatingMargin: none, freeCashFlow: none,
      cashConversion: none, returnOnInvestedCapital: none, netDebt: none, netDebtToEbitda: none,
      interestCoverage: none, shareBasedCompToRevenue: none, dilutionPerYear: none, returnOnEquity: none,
      equityToAssets: none,
    };
  }

  const revenue = v(last, "revenue");
  const netIncome = v(last, "netIncome");
  const opInc = v(last, "operatingIncome");
  const ratioOfRevenue = (item: LineItem, label: string): Measure => {
    const x = v(last, item);
    if (x === undefined) return missing(`${label} not reported.`);
    if (!revenue || revenue <= 0) return missing("Revenue not reported or not positive.");
    return ok(x / revenue);
  };

  const threeAgo = years[years.length - 4];
  const revenueGrowth3y = !threeAgo ? missing("Fewer than four years of reports.")
    : !(v(threeAgo, "revenue")! > 0) || !(revenue! > 0) ? missing("Revenue not reported or not positive.")
    : ok(cagr(v(threeAgo, "revenue")!, revenue!, last.fiscalYear - threeAgo.fiscalYear));

  const shares = splitAdjustedShares(years);
  const sharesNow = shares[shares.length - 1];
  const sharesThen = shares[shares.length - 4];
  const dilutionPerYear = sharesNow && sharesThen && threeAgo
    ? ok(cagr(sharesThen, sharesNow, last.fiscalYear - threeAgo.fiscalYear))
    : missing("Diluted share counts not reported for four years.");

  const equity = v(last, "equity");
  const prevEquity = v(years[years.length - 2], "equity");
  const assets = v(last, "assets");

  if (financial) {
    return {
      fiscalYear: last.fiscalYear,
      revenueGrowth3y,
      grossMargin: missing(NOT_FOR_FINANCIALS),
      operatingMargin: missing(NOT_FOR_FINANCIALS),
      freeCashFlow: missing(NOT_FOR_FINANCIALS),
      cashConversion: missing(NOT_FOR_FINANCIALS),
      returnOnInvestedCapital: missing(NOT_FOR_FINANCIALS),
      netDebt: missing(NOT_FOR_FINANCIALS),
      netDebtToEbitda: missing(NOT_FOR_FINANCIALS),
      interestCoverage: missing(NOT_FOR_FINANCIALS),
      shareBasedCompToRevenue: ratioOfRevenue("shareBasedComp", "Share-based pay"),
      dilutionPerYear,
      returnOnEquity: netIncome === undefined || equity === undefined ? missing("Net income or equity not reported.")
        : ok(netIncome / (prevEquity !== undefined ? (equity + prevEquity) / 2 : equity)),
      equityToAssets: equity === undefined || !assets ? missing("Equity or assets not reported.") : ok(equity / assets),
    };
  }

  const cfo = v(last, "operatingCashFlow");
  const capex = v(last, "capex");
  const fcf = cfo !== undefined && capex !== undefined ? cfo - capex : undefined;
  const debt = totalDebt(last);
  const cash = liquidAssets(last);
  const da = v(last, "depreciationAmortization");
  const ebitda = opInc !== undefined && da !== undefined ? opInc + da : undefined;
  const interest = v(last, "interestExpense");
  const netDebt = debt !== undefined && cash !== undefined ? debt - cash : undefined;

  const pretax = v(last, "pretaxIncome");
  const tax = v(last, "incomeTax");
  const taxRate = pretax && pretax > 0 && tax !== undefined ? Math.min(0.5, Math.max(0, tax / pretax)) : 0.21;
  const investedCapital = debt !== undefined && equity !== undefined && cash !== undefined ? debt + equity - cash : undefined;

  return {
    fiscalYear: last.fiscalYear,
    revenueGrowth3y,
    grossMargin: ratioOfRevenue("grossProfit", "Gross profit"),
    operatingMargin: ratioOfRevenue("operatingIncome", "Operating income"),
    freeCashFlow: fcf === undefined ? missing("Operating cash flow or capital spending not reported.") : ok(fcf),
    cashConversion: fcf === undefined ? missing("Operating cash flow or capital spending not reported.")
      : !(netIncome! > 0) ? missing("Net income was not positive.") : ok(fcf / netIncome!),
    returnOnInvestedCapital: opInc === undefined || investedCapital === undefined ? missing("Operating income, debt, equity or cash not reported.")
      : investedCapital <= 0 ? missing("Invested capital was not positive.") : ok((opInc * (1 - taxRate)) / investedCapital),
    netDebt: netDebt === undefined ? missing("Debt or cash not reported.") : ok(netDebt),
    netDebtToEbitda: netDebt === undefined || ebitda === undefined ? missing("Debt, cash or EBITDA not reported.")
      : ebitda <= 0 ? missing("EBITDA was not positive.") : ok(netDebt / ebitda),
    interestCoverage: opInc === undefined || interest === undefined ? missing("Operating income or interest expense not reported.")
      : interest <= 0 ? missing("No interest expense reported.") : ok(opInc / interest),
    shareBasedCompToRevenue: ratioOfRevenue("shareBasedComp", "Share-based pay"),
    dilutionPerYear,
    returnOnEquity: missing(FINANCIAL_ONLY),
    equityToAssets: missing(FINANCIAL_ONLY),
  };
}

export interface Valuation {
  marketCap: Measure;
  enterpriseValue: Measure;
  evToEbitda: Measure;
  priceToFreeCashFlow: Measure;
  priceToEarnings: Measure;
  /** Date of the share count used for market cap. */
  sharesAsOf: string | null;
}

/**
 * Valuation on trailing twelve months from a current share price (in the
 * reporting currency). Withheld when the filer reports in another currency or
 * under IFRS, where ADR share ratios make the share count unreliable.
 */
export function computeValuation(c: CompanyFilings, price: number): Valuation {
  const blocked = c.currency !== "USD" || c.taxonomy !== "us-gaap"
    ? missing("Not available for companies that report outside US GAAP or in another currency.")
    : !(price > 0) ? missing("No current price.")
    : !c.sharesOutstanding ? missing("Shares outstanding not reported.")
    : null;
  if (blocked) {
    return { marketCap: blocked, enterpriseValue: blocked, evToEbitda: blocked, priceToFreeCashFlow: blocked, priceToEarnings: blocked, sharesAsOf: null };
  }
  const t = c.trailing;
  const marketCap = price * c.sharesOutstanding!.value;
  const financial = isFinancialSic(c.sic);
  const debt = totalDebt(t);
  const cash = liquidAssets(t);
  const ev = !financial && debt !== undefined && cash !== undefined ? marketCap + debt - cash : undefined;
  const opInc = v(t, "operatingIncome");
  const da = v(t, "depreciationAmortization");
  const ebitda = opInc !== undefined && da !== undefined ? opInc + da : undefined;
  const cfo = v(t, "operatingCashFlow");
  const capex = v(t, "capex");
  const fcf = cfo !== undefined && capex !== undefined ? cfo - capex : undefined;
  const ni = v(t, "netIncome");

  return {
    marketCap: ok(marketCap),
    enterpriseValue: financial ? missing(NOT_FOR_FINANCIALS) : ev === undefined ? missing("Debt or cash not reported.") : ok(ev),
    evToEbitda: financial ? missing(NOT_FOR_FINANCIALS) : ev === undefined || ebitda === undefined ? missing("Enterprise value or EBITDA not available.")
      : ebitda <= 0 ? missing("EBITDA was not positive.") : ok(ev / ebitda),
    priceToFreeCashFlow: financial ? missing(NOT_FOR_FINANCIALS) : fcf === undefined ? missing("Free cash flow not available.")
      : fcf <= 0 ? missing("Free cash flow was not positive.") : ok(marketCap / fcf),
    priceToEarnings: ni === undefined ? missing("Net income not reported.")
      : ni <= 0 ? missing("Net income was not positive.") : ok(marketCap / ni),
    sharesAsOf: c.sharesOutstanding!.asOf,
  };
}
