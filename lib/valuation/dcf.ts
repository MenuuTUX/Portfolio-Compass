/**
 * Value-driver DCF, a pure model with no network or clock.
 *
 * FCF_t = NOPAT_t * (1 - max(g_t, 0) / RONIC). Growth is g1 for years 1 to 5,
 * then a straight line to the terminal growth rate by the last forecast year.
 * Margin moves linearly from margin0 to marginT, and tax fades linearly to the
 * marginal rate. Share-based pay is already inside operating income, so it is
 * not subtracted again.
 */

import { MIN_WACC_SPREAD, WACC_MAX, WACC_MIN } from "./limits";

export type DcfErrorCode = "non-finite" | "shares" | "wacc-range" | "wacc-spread" | "invalid";

export class DcfError extends Error {
  readonly code: DcfErrorCode;

  constructor(code: DcfErrorCode, message: string) {
    super(message);
    this.name = "DcfError";
    this.code = code;
  }
}

/** Size of the cost-of-capital shift in `sensitivity`. */
const WACC_STEP = 0.01;
export const MARGINAL_TAX = 0.25;
const EPS = 1e-12;

export interface DcfInputs {
  /** Last completed fiscal year revenue, in millions or any consistent unit. */
  rev0: number;
  /** Revenue growth for years 1 to 5. */
  g1: number;
  /** Terminal growth, reached at the last forecast year. */
  gT: number;
  /** Operating margin in the first forecast year. */
  margin0: number;
  /** Operating margin in the last forecast year. Defaults to margin0 (held). */
  marginT?: number;
  /** Effective tax rate in year 1. */
  tax: number;
  /** Marginal tax rate the tax rate fades to. Defaults to 25%. */
  taxMarginal?: number;
  /** Return on new invested capital. */
  ronic: number;
  /** Cost of capital (discount rate). */
  wacc: number;
  /** Debt and other claims minus cash and securities, in the same unit as rev0. */
  netClaims: number;
  /** Share count (diluted when known). */
  shares: number;
  midYear: boolean;
  /** Fraction of year 1 remaining, in (0, 1]. 1 is a full year. */
  stub: number;
  /** Forecast length in years, at least 5. Defaults to 10. */
  years?: number;
}

/** DCF inputs without the growth rate, which the reverse solver chooses. */
export type DcfBase = Omit<DcfInputs, "g1">;

export interface DcfYear {
  year: number;
  growth: number;
  revenue: number;
  margin: number;
  tax: number;
  nopat: number;
  reinvestmentRate: number;
  /** Cash flow in the period, after the stub pro-rating for year 1. */
  fcf: number;
  discountTime: number;
  pv: number;
}

export interface DcfResult {
  perShare: number;
  equity: number;
  ev: number;
  pvExplicit: number;
  pvTerminal: number;
  /** Undiscounted terminal value at the end of the forecast. */
  terminalValue: number;
  /** PV of the terminal value over enterprise value. Infinity when enterprise value is not positive. */
  terminalShare: number;
  /** Terminal value over the last forecast year's after-tax operating profit (NOPAT). Null when that profit is not positive. */
  terminalMultipleNopat: number | null;
  /** Terminal value over the last forecast year's operating profit before tax (EBIT). Null when that profit is not positive. */
  terminalMultipleEbit: number | null;
  years: DcfYear[];
}

export type GrowthSolve =
  | { status: "solved"; g: number }
  | { status: "multiple"; roots: number[] }
  | { status: "price-above-range" }
  | { status: "price-below-range" }
  | { status: "invalid"; code: DcfErrorCode | "price"; reason: string };

export type ReturnSolve =
  | { status: "solved"; wacc: number }
  | { status: "multiple"; roots: number[] }
  | { status: "price-above-range" }
  | { status: "price-below-range" }
  | { status: "invalid"; code: DcfErrorCode | "price"; reason: string };

export interface Sensitivity {
  waccMinus1: GrowthSolve;
  base: GrowthSolve;
  waccPlus1: GrowthSolve;
}

function check(i: DcfInputs): void {
  const numeric: (keyof DcfInputs)[] = ["rev0", "g1", "gT", "margin0", "tax", "ronic", "wacc", "netClaims", "shares", "stub"];
  for (const key of numeric) {
    if (!Number.isFinite(i[key] as number)) throw new DcfError("non-finite", `${key} must be a finite number.`);
  }
  for (const key of ["marginT", "taxMarginal"] as const) {
    if (i[key] !== undefined && !Number.isFinite(i[key])) throw new DcfError("non-finite", `${key} must be a finite number.`);
  }
  if (!(i.shares > 0)) throw new DcfError("shares", "Share count must be above zero.");
  if (!(i.ronic > 0)) throw new DcfError("invalid", "Return on new capital must be above zero.");
  if (!(i.rev0 > 0)) throw new DcfError("invalid", "Base revenue must be above zero.");
  if (!(i.stub > 0 && i.stub <= 1)) throw new DcfError("invalid", "The stub fraction must be above zero and at most one.");
  const years = i.years ?? 10;
  if (!Number.isInteger(years) || years < 5) throw new DcfError("invalid", "The forecast must be at least five years.");
  if (i.wacc < WACC_MIN - EPS || i.wacc > WACC_MAX + EPS) {
    throw new DcfError("wacc-range", "The cost of capital must sit inside the supported band.");
  }
  if (i.wacc - i.gT < MIN_WACC_SPREAD - EPS) {
    throw new DcfError("wacc-spread", "The cost of capital is too close to long-term growth for the model to work.");
  }
}

export function dcfValue(i: DcfInputs): DcfResult {
  check(i);
  const N = i.years ?? 10;
  const marginT = i.marginT ?? i.margin0;
  const taxMarginal = i.taxMarginal ?? MARGINAL_TAX;
  const stub = i.stub;

  let rev = i.rev0;
  let nopat = 0;
  let pvExplicit = 0;
  let df = 1;
  let time = 0;
  const years: DcfYear[] = [];

  for (let t = 1; t <= N; t++) {
    const growth = t <= 5 ? i.g1 : i.g1 + ((i.gT - i.g1) * (t - 5)) / (N - 5);
    rev *= 1 + growth;
    const margin = i.margin0 + ((marginT - i.margin0) * t) / N;
    const tax = i.tax + ((taxMarginal - i.tax) * t) / N;
    nopat = rev * margin * (1 - tax);
    const reinvestmentRate = Math.max(growth, 0) / i.ronic;
    const full = nopat * (1 - reinvestmentRate);
    const fcf = t === 1 ? full * stub : full;
    time = i.midYear ? (t === 1 ? stub / 2 : stub + t - 1.5) : (t === 1 ? stub : stub + t - 1);
    df = (1 + i.wacc) ** -time;
    const pv = fcf * df;
    pvExplicit += pv;
    years.push({ year: t, growth, revenue: rev, margin, tax, nopat, reinvestmentRate, fcf, discountTime: time, pv });
  }

  const terminalFcf = nopat * (1 + i.gT) * (1 - Math.max(i.gT, 0) / i.ronic);
  const terminalValue = terminalFcf / (i.wacc - i.gT);
  const pvTerminal = terminalValue * df;
  const ev = pvExplicit + pvTerminal;
  const equity = ev - i.netClaims;
  const lastYear = years[N - 1];
  const ebit = lastYear.revenue * lastYear.margin;

  return {
    perShare: equity / i.shares,
    equity,
    ev,
    pvExplicit,
    pvTerminal,
    terminalValue,
    terminalShare: ev > 0 ? pvTerminal / ev : Number.POSITIVE_INFINITY,
    terminalMultipleNopat: nopat > 0 ? terminalValue / nopat : null,
    terminalMultipleEbit: ebit > 0 ? terminalValue / ebit : null,
    years,
  };
}

/** Result of bisection over a grid: the roots, or the reason there are none. */
type Scan =
  | { kind: "roots"; roots: number[] }
  | { kind: "above" }
  | { kind: "below" }
  | { kind: "invalid"; code: DcfErrorCode | "price"; reason: string };

function errorOf(e: unknown): { code: DcfErrorCode; reason: string } {
  if (e instanceof DcfError) return { code: e.code, reason: e.message };
  return { code: "invalid", reason: "The inputs could not be evaluated." };
}

/** Samples f on a grid of 61 points, bisects every sign change, and checks each root against the price. */
function scan(f: (x: number) => number, lo: number, hi: number, price: number): Scan {
  const N = 61;
  const xs: number[] = [];
  const ys: number[] = [];
  try {
    for (let k = 0; k < N; k++) {
      const x = lo + ((hi - lo) * k) / (N - 1);
      const y = f(x);
      if (!Number.isFinite(y)) return { kind: "invalid", code: "invalid", reason: "The model gave a value that is not a number." };
      xs.push(x);
      ys.push(y);
    }
  } catch (e) {
    return { kind: "invalid", ...errorOf(e) };
  }

  const roots: number[] = [];
  for (let k = 0; k < N; k++) {
    if (ys[k] === 0) {
      roots.push(xs[k]);
      continue;
    }
    if (k + 1 < N && ys[k] * ys[k + 1] < 0) {
      let a = xs[k];
      let b = xs[k + 1];
      let fa = ys[k];
      for (let iter = 0; iter < 100 && b - a >= 1e-12; iter++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (fm === 0) {
          a = m;
          b = m;
          break;
        }
        if (Math.sign(fm) === Math.sign(fa)) {
          a = m;
          fa = fm;
        } else {
          b = m;
        }
      }
      roots.push((a + b) / 2);
    }
  }

  if (roots.length === 0) {
    if (ys.every((y) => y > 0)) return { kind: "below" };
    if (ys.every((y) => y < 0)) return { kind: "above" };
    return { kind: "invalid", code: "invalid", reason: "No root could be bracketed." };
  }
  for (const r of roots) {
    try {
      if (Math.abs(f(r)) / price >= 1e-6) {
        return { kind: "invalid", code: "invalid", reason: "The solver did not converge to a root." };
      }
    } catch (e) {
      return { kind: "invalid", ...errorOf(e) };
    }
  }
  return { kind: "roots", roots };
}

function priceOk(price: number): { code: "price"; reason: string } | null {
  return Number.isFinite(price) && price > 0 ? null : { code: "price", reason: "The share price must be above zero." };
}

/** Growth rate (years 1 to 5) that makes the forward value equal the price. Never clamped. */
export function impliedGrowth(base: DcfBase | DcfInputs, price: number): GrowthSolve {
  const bad = priceOk(price);
  if (bad) return { status: "invalid", ...bad };
  const result = scan((g) => dcfValue({ ...base, g1: g } as DcfInputs).perShare - price, -0.2, 0.6, price);
  if (result.kind === "above") return { status: "price-above-range" };
  if (result.kind === "below") return { status: "price-below-range" };
  if (result.kind === "invalid") return { status: "invalid", code: result.code, reason: result.reason };
  if (result.roots.length === 1) return { status: "solved", g: result.roots[0] };
  return { status: "multiple", roots: result.roots };
}

/** Cost of capital that makes the forward value equal the price, searched above the terminal growth guard. */
export function impliedReturn(base: DcfInputs, price: number): ReturnSolve {
  const bad = priceOk(price);
  if (bad) return { status: "invalid", ...bad };
  const lo = Math.max(WACC_MIN, base.gT + MIN_WACC_SPREAD);
  const hi = WACC_MAX;
  if (!(lo < hi)) return { status: "invalid", code: "wacc-spread", reason: "Long-term growth is too high for any cost of capital in range." };
  const result = scan((w) => dcfValue({ ...base, wacc: w }).perShare - price, lo, hi, price);
  if (result.kind === "above") return { status: "price-above-range" };
  if (result.kind === "below") return { status: "price-below-range" };
  if (result.kind === "invalid") return { status: "invalid", code: result.code, reason: result.reason };
  if (result.roots.length === 1) return { status: "solved", wacc: result.roots[0] };
  return { status: "multiple", roots: result.roots };
}

/** Implied growth at the cost of capital one point lower, unchanged, and one point higher. */
export function sensitivity(base: DcfBase | DcfInputs, price: number): Sensitivity {
  return {
    waccMinus1: impliedGrowth({ ...base, wacc: base.wacc - WACC_STEP }, price),
    base: impliedGrowth(base, price),
    waccPlus1: impliedGrowth({ ...base, wacc: base.wacc + WACC_STEP }, price),
  };
}
