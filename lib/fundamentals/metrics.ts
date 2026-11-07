import { isFinancialSic } from "./sector";
import type { AnnualPeriod, CompanyFilings, FactValue, LineItem } from "./types";

/** A computed measure, or null with the reason it could not be computed. `note` says how a value was derived. */
export type Measure = { value: number; note?: string; reason?: undefined } | { value: null; reason: string; note?: undefined };

/** D&A built from two tags (depreciation plus intangible amortization) can differ a little from the cash-flow total the company files. */
const approximateDaNote = (period: { items: Partial<Record<LineItem, { tag: string }>> } | null): string | undefined =>
  period?.items.depreciationAmortization?.tag.includes(" + ")
    ? "Some of this D&A is depreciation plus intangible amortization added from two tags; the cash-flow total the company files can differ by a few percent."
    : undefined;

const ok = (value: number, note?: string): Measure => {
  if (!Number.isFinite(value)) return { value: null, reason: "Not a finite number." };
  return note ? { value, note } : { value };
};
const missing = (reason: string): Measure => ({ value: null, reason });

type Period = { items: Partial<Record<LineItem, FactValue>> } | null | undefined;
const v = (p: Period, item: LineItem) => p?.items[item]?.value;

const NO_DEBT_WARNING = "No debt figures found in this filing";
const SHARE_CLASS_WARNING = "Multiple share classes; per-share values are approximate";

/**
 * Total debt, or undefined when the filing has no debt tag at all: unknown, not zero, so
 * valuation can refuse rather than net cash against nothing. Long-term plus current portion,
 * plus commercial paper, which "DebtCurrent" and "ShortTermBorrowings" already include.
 */
export function totalDebt(p: Period): number | undefined {
  if (!p) return undefined;
  const nonCurrent = v(p, "debtNoncurrent");
  const current = p.items.debtCurrent;
  const cp = v(p, "commercialPaper") ?? 0;
  const cpIncluded = current !== undefined && (current.tag === "DebtCurrent" || current.tag === "ShortTermBorrowings");
  const paper = cpIncluded ? 0 : cp;
  if (nonCurrent !== undefined) return nonCurrent + (current?.value ?? 0) + paper;
  const total = v(p, "debtTotal");
  if (total !== undefined) return total + cp;
  if (current !== undefined) return current.value + paper;
  if (p.items.commercialPaper !== undefined) return cp;
  return undefined;
}

/** Cash plus short-term investments, which analysts net against debt. */
export function liquidAssets(p: Period): number | undefined {
  const cash = v(p, "cash");
  return cash === undefined ? undefined : cash + (v(p, "shortTermInvestments") ?? 0);
}

/** Debt + equity - cash and short-term investments. */
function investedCapital(p: Period): number | undefined {
  const debt = totalDebt(p);
  const equity = v(p, "equity");
  const liquid = liquidAssets(p);
  return debt !== undefined && equity !== undefined && liquid !== undefined ? debt + equity - liquid : undefined;
}

/** Equity owned by common shareholders: total equity less preferred stock, when preferred is reported. */
function commonEquity(p: Period): number | undefined {
  const equity = v(p, "equity");
  return equity === undefined ? undefined : equity - (v(p, "preferredEquity") ?? 0);
}

/** Free cash flow: operating cash flow less capital spending, less finance lease principal when reported. */
export function freeCashFlow(p: Period): { value: number; note?: string } | undefined {
  const cfo = v(p, "operatingCashFlow");
  const capex = v(p, "capex");
  if (cfo === undefined || capex === undefined) return undefined;
  const lease = v(p, "financeLeasePayments");
  if (lease === undefined) return { value: cfo - capex };
  return { value: cfo - capex - lease, note: "Also subtracts finance lease principal payments." };
}

/** Average of closing and opening values; the closing value alone when there is no opening year. */
const average = (closing: number, opening: number | undefined) => (opening === undefined ? closing : (closing + opening) / 2);

/** Split factors seen in practice: n-for-1, 3-for-2, and their reverse splits. */
const SPLIT_RATIOS = [1.5, 2, 3, 4, 5, 10, 20].flatMap((r) => [r, 1 / r]);
/** A jump must match a split ratio within this tolerance. */
const SPLIT_TOLERANCE = 0.02;
/** A split is followed by a stable count; a genuine issuance that keeps moving is not a split. */
const SETTLE_TOLERANCE = 0.03;

const splitRatioFor = (jump: number) => SPLIT_RATIOS.find((r) => Math.abs(jump / r - 1) <= SPLIT_TOLERANCE);

/**
 * Diluted share counts adjusted for splits. Later filings restate recent years
 * for a split, but older years keep the pre-split count. A year-on-year jump that
 * matches a common split ratio (within 2%) is a split, provided the following
 * year's count stays put. Older years are scaled by every split found after them.
 */
export function splitAdjustedShares(annual: AnnualPeriod[]): (number | undefined)[] {
  const raw = annual.map((p) => v(p, "dilutedShares"));
  const out = [...raw];
  let factor = 1;
  for (let i = out.length - 1; i > 0; i--) {
    const newer = raw[i];
    const older = raw[i - 1];
    if (newer && older) {
      const ratio = splitRatioFor(newer / older);
      const next = i + 1 < raw.length ? raw[i + 1] : undefined;
      const settled = next === undefined || Math.abs(next / newer - 1) <= SETTLE_TOLERANCE;
      if (ratio !== undefined && settled) factor *= ratio;
    }
    if (older !== undefined) out[i - 1] = older * factor;
  }
  return out;
}

const cagr = (from: number, to: number, years: number) => Math.pow(to / from, 1 / years) - 1;

interface CompanyMetrics {
  fiscalYear: number | null;
  revenueGrowth3y: Measure;
  grossMargin: Measure;
  operatingMargin: Measure;
  freeCashFlow: Measure;
  /** Free cash flow divided by net income. */
  cashConversion: Measure;
  /** After-tax operating income over the average of opening and closing invested capital. */
  returnOnInvestedCapital: Measure;
  /** Null when the filing has no debt tag at all. */
  totalDebt: Measure;
  netDebt: Measure;
  netDebtToEbitda: Measure;
  interestCoverage: Measure;
  shareBasedCompToRevenue: Measure;
  /** Diluted share count change a year over three years; negative means buybacks. */
  dilutionPerYear: Measure;
  /** Financial companies only: net income to common over average common equity. */
  returnOnEquity: Measure;
  equityToAssets: Measure;
  /** Data-quality notes about the figures behind these measures. */
  warnings: string[];
}

const FINANCIAL_ONLY = "Shown for financial companies only.";
const NOT_FOR_FINANCIALS = "Not meaningful for a financial company.";

export function computeMetrics(c: CompanyFilings): CompanyMetrics {
  const years = c.annual;
  const last = years[years.length - 1];
  const prev = years[years.length - 2];
  const financial = isFinancialSic(c.sic);
  const none = missing("No annual report found.");
  if (!last) {
    return {
      fiscalYear: null, revenueGrowth3y: none, grossMargin: none, operatingMargin: none, freeCashFlow: none,
      cashConversion: none, returnOnInvestedCapital: none, totalDebt: none, netDebt: none, netDebtToEbitda: none,
      interestCoverage: none, shareBasedCompToRevenue: none, dilutionPerYear: none, returnOnEquity: none,
      equityToAssets: none, warnings: [],
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

  const assets = v(last, "assets");
  const equity = v(last, "equity");

  if (financial) {
    const niCommon = v(last, "netIncomeToCommon") ?? netIncome;
    const common = commonEquity(last);
    return {
      fiscalYear: last.fiscalYear,
      revenueGrowth3y,
      grossMargin: missing(NOT_FOR_FINANCIALS),
      operatingMargin: missing(NOT_FOR_FINANCIALS),
      freeCashFlow: missing(NOT_FOR_FINANCIALS),
      cashConversion: missing(NOT_FOR_FINANCIALS),
      returnOnInvestedCapital: missing(NOT_FOR_FINANCIALS),
      totalDebt: missing(NOT_FOR_FINANCIALS),
      netDebt: missing(NOT_FOR_FINANCIALS),
      netDebtToEbitda: missing(NOT_FOR_FINANCIALS),
      interestCoverage: missing(NOT_FOR_FINANCIALS),
      shareBasedCompToRevenue: ratioOfRevenue("shareBasedComp", "Share-based pay"),
      dilutionPerYear,
      returnOnEquity: niCommon === undefined || common === undefined ? missing("Net income or equity not reported.")
        : ok(niCommon / average(common, commonEquity(prev))),
      equityToAssets: equity === undefined || !assets ? missing("Equity or assets not reported.") : ok(equity / assets),
      warnings: [],
    };
  }

  const fcf = freeCashFlow(last);
  const debt = totalDebt(last);
  const cash = liquidAssets(last);
  const da = v(last, "depreciationAmortization");
  const ebitda = opInc !== undefined && da !== undefined ? opInc + da : undefined;
  const daNote = approximateDaNote(last);
  const interest = v(last, "interestExpense");
  const netDebt = debt !== undefined && cash !== undefined ? debt - cash : undefined;

  const pretax = v(last, "pretaxIncome");
  const tax = v(last, "incomeTax");
  const taxRate = pretax && pretax > 0 && tax !== undefined ? Math.min(0.5, Math.max(0, tax / pretax)) : 0.21;
  const ic = investedCapital(last);
  const icAverage = ic === undefined ? undefined : average(ic, investedCapital(prev));

  return {
    fiscalYear: last.fiscalYear,
    revenueGrowth3y,
    grossMargin: ratioOfRevenue("grossProfit", "Gross profit"),
    operatingMargin: ratioOfRevenue("operatingIncome", "Operating income"),
    freeCashFlow: fcf === undefined ? missing("Operating cash flow or capital spending not reported.") : ok(fcf.value, fcf.note),
    cashConversion: fcf === undefined ? missing("Operating cash flow or capital spending not reported.")
      : !(netIncome! > 0) ? missing("Net income was not positive.") : ok(fcf.value / netIncome!),
    returnOnInvestedCapital: opInc === undefined || icAverage === undefined ? missing("Operating income, debt, equity or cash not reported.")
      : icAverage <= 0 ? missing("Invested capital was not positive.") : ok((opInc * (1 - taxRate)) / icAverage),
    totalDebt: debt === undefined ? missing(NO_DEBT_WARNING) : ok(debt),
    netDebt: netDebt === undefined ? missing("Debt or cash not reported.") : ok(netDebt),
    netDebtToEbitda: netDebt === undefined || ebitda === undefined ? missing("Debt, cash or EBITDA not reported.")
      : ebitda <= 0 ? missing("EBITDA was not positive.") : ok(netDebt / ebitda, daNote),
    interestCoverage: opInc === undefined || interest === undefined ? missing("Operating income or interest expense not reported.")
      : interest <= 0 ? missing("No interest expense reported.") : ok(opInc / interest),
    shareBasedCompToRevenue: ratioOfRevenue("shareBasedComp", "Share-based pay"),
    dilutionPerYear,
    returnOnEquity: missing(FINANCIAL_ONLY),
    equityToAssets: missing(FINANCIAL_ONLY),
    warnings: debt === undefined ? [NO_DEBT_WARNING] : [],
  };
}

/** A stock split: `ratio` 10 means 10-for-1, `date` when it took effect (YYYY-MM-DD). */
interface StockSplit {
  date: string;
  ratio: number;
}

export interface Valuation {
  marketCap: Measure;
  enterpriseValue: Measure;
  evToEbitda: Measure;
  priceToFreeCashFlow: Measure;
  priceToEarnings: Measure;
  /** Date of the cover-page share count used for market cap. */
  sharesAsOf: string | null;
  /** Data-quality notes: share counts that disagree, several share classes, or missing debt. */
  warnings: string[];
}

/**
 * Valuation on trailing twelve months from a current share price (in the
 * reporting currency). Withheld when the filer reports in another currency or
 * under IFRS, where ADR share ratios make the share count unreliable.
 *
 * Market cap uses the cover-page share count, restated for each split dated after
 * that count (a 10-for-1 split after a pre-split cover date multiplies it by 10).
 */
export function computeValuation(c: CompanyFilings, price: number, options: { splits?: StockSplit[] } = {}): Valuation {
  const blocked = c.currency !== "USD" || c.taxonomy !== "us-gaap"
    ? missing("Not available for companies that report outside US GAAP or in another currency.")
    : !(price > 0) ? missing("No current price.")
    : !c.sharesOutstanding ? missing("Shares outstanding not reported.")
    : null;
  if (blocked) {
    return {
      marketCap: blocked, enterpriseValue: blocked, evToEbitda: blocked, priceToFreeCashFlow: blocked,
      priceToEarnings: blocked, sharesAsOf: null, warnings: [],
    };
  }
  const cover = c.sharesOutstanding!;
  const t = c.trailing;
  const splitsAfter = (options.splits ?? []).filter((s) => s.date > cover.asOf);
  const shares = splitsAfter.reduce((n, s) => n * s.ratio, cover.value);

  const warnings: string[] = [];
  const diluted = v(t, "dilutedShares") ?? v(c.annual[c.annual.length - 1], "dilutedShares");
  if (diluted && diluted > 0 && (shares / diluted > 1.5 || diluted / shares > 1.5)) {
    warnings.push("Cover-page share count differs from the latest diluted share count by more than 1.5x, and no split explains it; market cap may be wrong.");
  }
  if (cover.classes > 1) warnings.push(SHARE_CLASS_WARNING);
  if (t?.missingOnBalanceDate.includes("shortTermInvestments")) {
    warnings.push(`Short-term investments are not reported on the balance sheet date ${t.balanceSheetDate}; enterprise value may be overstated.`);
  }

  const marketCap = price * shares;
  const financial = isFinancialSic(c.sic);
  const debt = totalDebt(t);
  const cash = liquidAssets(t);
  if (debt === undefined && !financial) warnings.push(NO_DEBT_WARNING);
  const ev = !financial && debt !== undefined && cash !== undefined ? marketCap + debt - cash : undefined;
  const opInc = v(t, "operatingIncome");
  const da = v(t, "depreciationAmortization");
  const ebitda = opInc !== undefined && da !== undefined ? opInc + da : undefined;
  const daNote = approximateDaNote(t);
  const fcf = freeCashFlow(t);
  const ni = v(t, "netIncome");

  return {
    marketCap: ok(marketCap, splitsAfter.length ? `Cover-page shares restated for ${splitsAfter.length} split(s) after ${cover.asOf}.` : undefined),
    enterpriseValue: financial ? missing(NOT_FOR_FINANCIALS)
      : ev === undefined ? missing(debt === undefined ? NO_DEBT_WARNING : "Debt or cash not reported.") : ok(ev),
    evToEbitda: financial ? missing(NOT_FOR_FINANCIALS) : ev === undefined || ebitda === undefined ? missing("Enterprise value or EBITDA not available.")
      : ebitda <= 0 ? missing("EBITDA was not positive.") : ok(ev / ebitda, daNote),
    priceToFreeCashFlow: financial ? missing(NOT_FOR_FINANCIALS) : fcf === undefined ? missing("Free cash flow not available.")
      : fcf.value <= 0 ? missing("Free cash flow was not positive.") : ok(marketCap / fcf.value, fcf.note),
    priceToEarnings: ni === undefined ? missing("Net income not reported.")
      : ni <= 0 ? missing("Net income was not positive.") : ok(marketCap / ni),
    sharesAsOf: cover.asOf,
    warnings,
  };
}
