/**
 * Decides whether a company can be run through the cash-flow model, and turns
 * its filings into DCF inputs with a source label for each.
 *
 * Reads only the existing CompanyFilings fields, through the small adapter below,
 * so changes elsewhere in lib/fundamentals stay contained here.
 */
import type { AnnualPeriod, CompanyFilings, FactValue, LineItem, TrailingPeriod } from "../fundamentals/types";
import { blumeAdjustBeta, computeWacc, terminalGrowthCap } from "./wacc";
import { MARGINAL_TAX, type DcfInputs } from "./dcf";
import { kindForSic } from "../fundamentals/sector";

export interface ReadinessContext {
  /** Valuation date, YYYY-MM-DD. The library never reads the clock. */
  today: string;
  /** Current share price in the reporting currency (USD). */
  price: number;
  /** 10-year Treasury yield, decimal. */
  riskFree: number;
  /** Raw two-year weekly beta against the market. */
  rawBeta: number;
  /** Defaults to 4.5%. */
  equityRiskPremium?: number;
  /**
   * Shares outstanding now, from the quote. The filing's cover-page count can be
   * stale after a split; when the two differ by more than 25% the model is withheld.
   */
  currentShares?: number;
  /** "wacc" (neutral, default) or "history" (average ROIC, floored at WACC, capped at 60%). */
  ronicBasis?: "wacc" | "history";
}

export type ReadinessResult =
  | { ok: true; inputs: DcfInputs; sources: Record<string, string>; warnings: string[] }
  | { ok: false; reasons: string[] };

type Items = Partial<Record<LineItem, FactValue>>;
type Period = { items: Items } | AnnualPeriod | TrailingPeriod | null | undefined;

const DAY = 86_400_000;
const DEFAULT_ERP = 0.045;
/** Upper limit on the return on new capital taken from history. Asset-light leaders earn far more; the input is editable. */
const RONIC_CAP = 0.6;
const DEFAULT_TERMINAL_GROWTH = 0.025;
const DEFAULT_TAX = MARGINAL_TAX;

// Adapter over the fundamentals field names. Only this section reads CompanyFilings items.
const itemValue = (p: Period, key: LineItem): number | undefined => (p ? p.items[key]?.value : undefined);

function totalDebtOf(p: Period): number | undefined {
  const noncurrent = itemValue(p, "debtNoncurrent");
  const total = itemValue(p, "debtTotal");
  const cp = itemValue(p, "commercialPaper") ?? 0;
  if (noncurrent !== undefined) return noncurrent + (itemValue(p, "debtCurrent") ?? 0) + cp;
  if (total !== undefined) return total + cp;
  return undefined;
}

function cashOf(p: Period): number | undefined {
  const cash = itemValue(p, "cash");
  return cash === undefined
    ? undefined
    : cash + (itemValue(p, "shortTermInvestments") ?? 0) + (itemValue(p, "marketableSecuritiesNoncurrent") ?? 0);
}

/** Debt items whose tags already include capital (finance) leases, so those leases must not be added again. */
const DEBT_KEYS = ["debtNoncurrent", "debtCurrent", "debtTotal"] as const;
const debtIncludesLeases = (balance: Period, last: Period): boolean => {
  const source = totalDebtOf(balance) !== undefined ? balance : last;
  return DEBT_KEYS.some((k) => /CapitalLease/.test(source?.items[k]?.tag ?? ""));
};

/** Latest value of an award figure, read back through the annual periods. Null when the newest one is over two fiscal years old. */
const AWARD_MAX_AGE_YEARS = 2;
function recentAward(annual: AnnualPeriod[], key: LineItem, latestFy: number): number | undefined {
  for (let i = annual.length - 1; i >= 0; i--) {
    const value = itemValue(annual[i], key);
    if (value !== undefined) return latestFy - annual[i].fiscalYear > AWARD_MAX_AGE_YEARS ? undefined : value;
  }
  return undefined;
}

function effectiveTax(p: AnnualPeriod | undefined): number | undefined {
  const pretax = itemValue(p, "pretaxIncome");
  const tax = itemValue(p, "incomeTax");
  if (pretax === undefined || tax === undefined || !(pretax > 0)) return undefined;
  return Math.min(0.5, Math.max(0, tax / pretax));
}

const SECTOR_REASON = "Cash-flow models do not suit banks, insurers or REITs, whose borrowing is part of the business.";

const parseDay = (s: string) => Date.parse(`${s}T00:00:00Z`);
const monthsLater = (s: string, months: number) => {
  const d = new Date(parseDay(s));
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate());
};

/** Days to the next anniversary of the last fiscal year end, as a fraction of a year, capped at 1. */
function stubFraction(lastEnd: string, today: string): number {
  const todayMs = parseDay(today);
  const [, m, d] = lastEnd.split("-").map(Number);
  let year = Number(today.slice(0, 4)) - 1;
  let next = Date.UTC(year, m - 1, d);
  while (next <= todayMs) {
    year += 1;
    next = Date.UTC(year, m - 1, d);
  }
  return Math.min(1, (next - todayMs) / DAY / 365);
}

/** Revenue growth per year over up to five years of annual history. */
function revenueCagr(annual: AnnualPeriod[]): number | undefined {
  const points = annual.filter((p) => (itemValue(p, "revenue") ?? 0) > 0);
  if (points.length < 2) return undefined;
  const from = points[Math.max(0, points.length - 6)];
  const to = points[points.length - 1];
  const years = to.fiscalYear - from.fiscalYear;
  if (years <= 0) return undefined;
  return Math.pow(itemValue(to, "revenue")! / itemValue(from, "revenue")!, 1 / years) - 1;
}

/** Average ROIC over up to five years, with invested capital = debt + equity - cash. */
function averageRoic(annual: AnnualPeriod[]): number | undefined {
  const values: number[] = [];
  for (const p of annual) {
    const opInc = itemValue(p, "operatingIncome");
    const debt = totalDebtOf(p);
    const equity = itemValue(p, "equity");
    const cash = cashOf(p);
    if (opInc === undefined || debt === undefined || equity === undefined || cash === undefined) continue;
    const invested = debt + equity - cash;
    if (!(invested > 0)) continue;
    values.push((opInc * (1 - (effectiveTax(p) ?? DEFAULT_TAX))) / invested);
  }
  const recent = values.slice(-5);
  return recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : undefined;
}

export function checkReadiness(company: CompanyFilings, ctx: ReadinessContext): ReadinessResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ctx.today)) throw new Error("ctx.today must be YYYY-MM-DD.");
  const reasons: string[] = [];

  if (kindForSic(company.sic) !== "operating") reasons.push(SECTOR_REASON);
  if (company.taxonomy !== "us-gaap") {
    reasons.push("This company reports under IFRS rather than US GAAP, so the model is withheld.");
  }
  if (company.currency !== "USD") {
    reasons.push(`This company reports in ${company.currency}, and this model only handles US dollars.`);
  }

  const last = company.annual[company.annual.length - 1];
  if (!last) {
    const files = (form: string) => company.filings.some((f) => f.form === form);
    reasons.push(
      files("10-K")
        ? "This registrant files its annual report together with its parent, and the SEC's data carries no annual figures under this entity. Look up the parent company instead."
        : files("10-Q")
          ? "This registrant has filed quarterly reports but no annual report yet, which usually means a newly formed holding company or a recent listing. Its earlier financials sit under a predecessor registrant that is not linked here."
          : "No annual report was found.",
    );
  } else {
    if (parseDay(ctx.today) > monthsLater(last.end, 15)) {
      reasons.push(`The latest annual report covers the year ending ${last.end}, more than 15 months ago.`);
    }
    const revenue = itemValue(last, "revenue");
    if (revenue === undefined || !(revenue > 0)) reasons.push("Revenue is not reported or is not positive.");
    if (itemValue(last, "operatingIncome") === undefined) reasons.push("Operating income is not reported, so the margin cannot be held.");

    const cfo = itemValue(last, "operatingCashFlow");
    const capex = itemValue(last, "capex");
    if (cfo === undefined || capex === undefined) {
      reasons.push("Operating cash flow or capital spending is not reported.");
    } else if (cfo - capex <= 0 && (revenue ?? 0) > 0) {
      reasons.push("This company has not produced positive free cash flow, so the model would rest mostly on guesses about later years.");
    }
  }

  const balance: Period = company.trailing ?? last;
  const debt = totalDebtOf(balance) ?? totalDebtOf(last);
  if (debt === undefined) reasons.push("Total debt is not reported.");
  const cash = cashOf(balance) ?? cashOf(last);
  if (cash === undefined) reasons.push("Cash is not reported.");
  // Multi-class companies (Alphabet, Meta) have no usable cover-page total in the SEC's summary data; the
  // weighted-average diluted count from the latest year is the closest reported total.
  const coverShares = company.sharesOutstanding?.value;
  const dilutedShares = itemValue(last, "dilutedShares");
  const sharesFromFiling = coverShares && coverShares > 0 ? coverShares : dilutedShares;
  if (!sharesFromFiling || !(sharesFromFiling > 0)) reasons.push("Share count is not reported.");
  if (!(ctx.price > 0)) reasons.push("There is no current share price.");
  const cover = coverShares;
  if (cover && ctx.currentShares && ctx.currentShares > 0 && Math.abs(cover / ctx.currentShares - 1) > 0.25) {
    reasons.push("The share count in the latest filing is more than 25% away from the current count, which usually means a stock split or a large change since that filing. The valuation is withheld until the next filing catches up.");
  }

  if (reasons.length > 0 || !last || debt === undefined || cash === undefined || !sharesFromFiling) {
    return { ok: false, reasons };
  }

  const rev0 = itemValue(last, "revenue")!;
  const opInc = itemValue(last, "operatingIncome")!;
  const margin = opInc / rev0;
  const tax = effectiveTax(last);
  const taxStart = tax ?? DEFAULT_TAX;
  const riskFreeRate = ctx.riskFree;
  const erp = ctx.equityRiskPremium ?? DEFAULT_ERP;

  // Claims ahead of common shareholders that the debt and cash lines miss. Each reads the balance-sheet date only.
  const leasesInDebt = debtIncludesLeases(balance, last);
  const leaseItems = [itemValue(balance, "financeLeaseLiabilityNoncurrent"), itemValue(balance, "financeLeaseLiabilityCurrent")];
  const leaseClaim = leasesInDebt ? 0 : (leaseItems[0] ?? 0) + (leaseItems[1] ?? 0);
  const minority = itemValue(balance, "minorityInterest") ?? 0;
  const preferred = itemValue(balance, "preferredStock") ?? 0;
  const fundedStatus = itemValue(balance, "pensionFundedStatus");
  const pensionDeficit = fundedStatus !== undefined ? Math.max(0, -fundedStatus) : itemValue(balance, "pensionLiabilityNoncurrent");
  const pensionClaim = (pensionDeficit ?? 0) * (1 - MARGINAL_TAX);
  const netClaims = debt - cash + leaseClaim + minority + preferred + pensionClaim;
  const bridgeMissing: string[] = [];
  if (!leasesInDebt && leaseItems.every((v) => v === undefined)) bridgeMissing.push("finance leases");
  if (itemValue(balance, "minorityInterest") === undefined) bridgeMissing.push("noncontrolling interest");
  if (itemValue(balance, "preferredStock") === undefined) bridgeMissing.push("preferred stock");
  if (pensionDeficit === undefined) bridgeMissing.push("pension and retiree health plans");

  // Dilution by the treasury stock method, only on top of the basic cover-page count. A diluted weighted average already includes it.
  const latestFy = last.fiscalYear;
  let shares = sharesFromFiling;
  const dilutionAdded: string[] = [];
  const dilutionMissing: string[] = [];
  if (coverShares && coverShares > 0) {
    const rsus = recentAward(company.annual, "rsusUnvested", latestFy);
    if (rsus === undefined) dilutionMissing.push("unvested RSUs");
    else {
      shares += rsus;
      dilutionAdded.push("unvested RSUs");
    }
    const options = recentAward(company.annual, "optionsOutstanding", latestFy);
    const strike = recentAward(company.annual, "optionsExercisePrice", latestFy);
    if (options === undefined || (options > 0 && strike === undefined)) dilutionMissing.push("options");
    else {
      shares += options > 0 ? options * Math.max(0, 1 - strike! / ctx.price) : 0;
      if (options > 0) dilutionAdded.push("in-the-money options");
    }
  }

  const interest = itemValue(last, "interestExpense");
  const bookCostOfDebt = interest !== undefined && interest > 0 && debt > 0 ? interest / debt : riskFreeRate + 0.01;

  let wacc;
  try {
    wacc = computeWacc({
      riskFree: riskFreeRate,
      beta: blumeAdjustBeta(ctx.rawBeta),
      equityRiskPremium: erp,
      preTaxCostOfDebt: bookCostOfDebt,
      marginalTaxRate: MARGINAL_TAX,
      marketCap: ctx.price * shares,
      totalDebt: debt,
    });
  } catch {
    return { ok: false, reasons: ["The cost of capital could not be calculated from these inputs."] };
  }

  const cap = terminalGrowthCap(riskFreeRate);
  const terminalGrowth = Math.min(DEFAULT_TERMINAL_GROWTH, cap);
  const cagr = revenueCagr(company.annual);
  const g1 = cagr ?? 0;
  const roicHistory = averageRoic(company.annual);
  const ronicFromHistory = roicHistory === undefined ? wacc.wacc : Math.min(RONIC_CAP, Math.max(wacc.wacc, roicHistory));
  const ronic = ctx.ronicBasis === "history" ? ronicFromHistory : wacc.wacc;

  const inputs: DcfInputs = {
    rev0,
    g1,
    gT: terminalGrowth,
    margin0: margin,
    marginT: margin,
    tax: taxStart,
    taxMarginal: MARGINAL_TAX,
    ronic,
    wacc: wacc.wacc,
    netClaims,
    shares,
    midYear: true,
    stub: stubFraction(last.end, ctx.today),
    years: 10,
  };

  const sources: Record<string, string> = {
    rev0: `Revenue for the fiscal year ending ${last.end}.`,
    g1: cagr === undefined ? "No revenue history to measure growth from; set to 0%." : "Revenue growth per year over the reported annual history.",
    gT: `Terminal growth, the lower of ${(DEFAULT_TERMINAL_GROWTH * 100).toFixed(1)}% and the risk-free rate.`,
    margin0: "Operating margin of the last fiscal year, held. Share-based pay is already inside operating income and is not subtracted again.",
    tax: tax === undefined ? "No reported tax on pre-tax income; the 25% marginal rate is used." : "Effective tax rate of the last fiscal year, fading to 25% over the forecast.",
    ronic: ctx.ronicBasis === "history"
      ? (roicHistory === undefined ? "No return history; set equal to the cost of capital." : "Average return on invested capital, floored at the cost of capital and capped at 60%.")
      : "Set equal to the cost of capital, so growth adds no value.",
    wacc: `CAPM cost of equity and book cost of debt, weighted by market value. Beta ${blumeAdjustBeta(ctx.rawBeta).toFixed(2)} after adjustment.`,
    netClaims: "Total debt minus cash, short-term investments and securities held beyond one year, from the latest balance sheet. Added: finance lease liabilities (unless the debt already includes them), noncontrolling interest, preferred stock, and any unfunded pension or retiree health deficit after tax at 25%. Operating leases are left out because their cost is already in operating income.",
    shares: coverShares && coverShares > 0
      ? `Cover-page shares outstanding (basic)${dilutionAdded.length ? `, plus ${dilutionAdded.join(" and ")} by the treasury stock method` : ""}.`
      : "Average diluted shares of the latest fiscal year, which already include dilution from options and RSUs.",
    stub: `Share of the current fiscal year left after ${ctx.today}, from the fiscal year end ${last.end}.`,
  };

  const warnings = [...wacc.warnings];
  if (coverShares && coverShares > 0 && dilutionMissing.length > 0) {
    warnings.push(
      dilutionMissing.length === 2
        ? "Dilution from options and RSUs was not included, because the filing has no recent figure for them."
        : `Dilution from options and RSUs was not included in full: the filing has no recent figure for ${dilutionMissing[0]}.`,
    );
  }
  if (!(coverShares && coverShares > 0)) {
    warnings.push("The filing has no cover-page total for this company's share classes, so the average diluted share count of the latest year is used.");
  }
  if (bridgeMissing.length > 0) {
    warnings.push(`Not reported in the latest balance sheet, so counted as zero: ${bridgeMissing.join(", ")}.`);
  }
  if (cagr === undefined) warnings.push("No revenue history was available, so growth starts at 0%.");

  return { ok: true, inputs, sources, warnings };
}
