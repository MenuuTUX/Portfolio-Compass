import { DcfError } from "./dcf";
import { TERMINAL_GROWTH_MAX, WACC_CEILING, WACC_FLOOR } from "./limits";

export interface WaccInputs {
  /** 10-year Treasury yield, decimal. */
  riskFree: number;
  /** Beta used in CAPM, already adjusted if wanted. */
  beta: number;
  equityRiskPremium: number;
  preTaxCostOfDebt: number;
  marginalTaxRate: number;
  /** Market value of equity, in the same unit as totalDebt. */
  marketCap: number;
  totalDebt: number;
}

export interface WaccResult {
  costOfEquity: number;
  afterTaxCostOfDebt: number;
  equityWeight: number;
  debtWeight: number;
  /** Weighted cost before the floor and ceiling. */
  rawWacc: number;
  /** Weighted cost after clamping to the band. */
  wacc: number;
  clamped: boolean;
  warnings: string[];
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function computeWacc(i: WaccInputs): WaccResult {
  const numeric: (keyof WaccInputs)[] = ["riskFree", "beta", "equityRiskPremium", "preTaxCostOfDebt", "marginalTaxRate", "marketCap", "totalDebt"];
  for (const key of numeric) {
    if (!Number.isFinite(i[key])) throw new DcfError("non-finite", `${key} must be a finite number.`);
  }
  if (!(i.marketCap > 0)) throw new DcfError("invalid", "Market value of equity must be above zero.");
  if (i.totalDebt < 0) throw new DcfError("invalid", "Total debt cannot be negative.");

  const costOfEquity = i.riskFree + i.beta * i.equityRiskPremium;
  const afterTaxCostOfDebt = i.preTaxCostOfDebt * (1 - i.marginalTaxRate);
  const capital = i.marketCap + i.totalDebt;
  const equityWeight = i.marketCap / capital;
  const debtWeight = i.totalDebt / capital;
  const rawWacc = equityWeight * costOfEquity + debtWeight * afterTaxCostOfDebt;

  let wacc = rawWacc;
  const warnings: string[] = [];
  let clamped = false;
  if (rawWacc < WACC_FLOOR) {
    wacc = WACC_FLOOR;
    clamped = true;
    warnings.push(`The calculated cost of capital of ${pct(rawWacc)} was raised to the ${pct(WACC_FLOOR)} floor.`);
  } else if (rawWacc > WACC_CEILING) {
    wacc = WACC_CEILING;
    clamped = true;
    warnings.push(`The calculated cost of capital of ${pct(rawWacc)} was lowered to the ${pct(WACC_CEILING)} ceiling.`);
  }

  return { costOfEquity, afterTaxCostOfDebt, equityWeight, debtWeight, rawWacc, wacc, clamped, warnings };
}

/** Blume adjustment: shrinks a raw beta toward 1. */
export function blumeAdjustBeta(raw: number): number {
  return 0.67 * raw + 0.33;
}

/** Long-term growth may not exceed the risk-free rate or the fixed cap. */
export function terminalGrowthCap(riskFree: number): number {
  return Math.min(riskFree, TERMINAL_GROWTH_MAX);
}
