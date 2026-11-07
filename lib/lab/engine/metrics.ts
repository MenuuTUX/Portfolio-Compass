import type { SimResult, Trade } from "@/lib/lab/engine/simulate";
import { mean, std } from "@/lib/math/stats";
import { daysBetween, YEAR_DAYS } from "@/lib/dates";

// Performance statistics for a Compass Lab run. Returns are time-weighted:
// each day's external cash flow is removed before computing that day's
// return, so contributions do not count as performance.

const DEFAULT_PERIODS_PER_YEAR = 252;

export interface Drawdown {
  depth: number;
  peak: string;
  trough: string;
  /** First date the index regained its prior peak, or null if it has not. */
  recovered: string | null;
}

export interface Metrics {
  startDate: string;
  endDate: string;
  finalEquity: number;
  netContributions: number;
  totalReturn: number;
  cagr: number;
  volatility: number;
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
  maxDrawdown: Drawdown | null;
  /** Calendar days of the longest stretch below a prior peak. */
  longestDrawdownDays: number;
  beta: number | null;
  alpha: number | null;
  positiveMonths: number | null;
  monthlyReturns: { month: string; return: number }[];
  /**
   * Average annual turnover: the smaller of purchases and sales, as a fraction
   * of average equity. Funding the portfolio and reinvesting dividends are
   * purchases only, so buy and hold is about 0.
   */
  turnover: number;
  costsPaid: number;
  dividendsReceived: number;
  trades: number;
}

/**
 * Daily time-weighted returns; index 0 is 0. The simulator applies a flow at
 * the start of its bar and invests it that day, so it joins the base the day's
 * return is earned on.
 */
export function dailyReturns(equity: Float64Array, flows: Float64Array): Float64Array {
  const r = new Float64Array(equity.length);
  for (let t = 1; t < equity.length; t++) {
    const base = equity[t - 1] + flows[t];
    r[t] = base > 0 ? equity[t] / base - 1 : 0;
  }
  return r;
}

/**
 * Return observations per year, read from the dates. An equity calendar gives
 * about 252 and is kept at 252 by convention; a market that trades every day
 * (crypto) gives about 365, so volatility and Sharpe are not understated.
 */
export function periodsPerYear(dates: string[]): number {
  const years = daysBetween(dates[0], dates[dates.length - 1]) / YEAR_DAYS;
  if (!(years > 0) || dates.length < 3) return DEFAULT_PERIODS_PER_YEAR;
  const observed = (dates.length - 1) / years;
  return Math.abs(observed - DEFAULT_PERIODS_PER_YEAR) <= 12 ? DEFAULT_PERIODS_PER_YEAR : Math.round(observed);
}

export function drawdowns(dates: string[], index: ArrayLike<number>): { max: Drawdown | null; longestDays: number } {
  let peak = index[0];
  let peakAt = 0;
  let below = false;
  let max: Drawdown | null = null;
  let longestDays = 0;
  for (let t = 1; t < index.length; t++) {
    if (index[t] >= peak) {
      if (below) {
        longestDays = Math.max(longestDays, daysBetween(dates[peakAt], dates[t]));
        if (max && max.recovered === null && max.peak === dates[peakAt]) max.recovered = dates[t];
        below = false;
      }
      peak = index[t];
      peakAt = t;
      continue;
    }
    below = true;
    const depth = index[t] / peak - 1;
    if (!max || depth < max.depth) max = { depth, peak: dates[peakAt], trough: dates[t], recovered: null };
  }
  if (below) longestDays = Math.max(longestDays, daysBetween(dates[peakAt], dates[index.length - 1]));
  return { max, longestDays };
}

export function computeMetrics(
  dates: string[],
  sim: Pick<SimResult, "equity" | "flows" | "trades" | "costsPaid" | "dividendsReceived">,
  { initialCash, benchmark, riskFree = 0 }: {
    initialCash: number;
    benchmark?: Float64Array;
    riskFree?: number;
  },
): Metrics {
  const T = dates.length;
  const r = dailyReturns(sim.equity, sim.flows);
  const rs = r.subarray(1);
  const index = new Float64Array(T);
  index[0] = 1;
  for (let t = 1; t < T; t++) index[t] = index[t - 1] * (1 + r[t]);

  const years = daysBetween(dates[0], dates[T - 1]) / YEAR_DAYS;
  const TRADING_DAYS = periodsPerYear(dates);
  const totalReturn = index[T - 1] - 1;
  const cagr = years > 0 && index[T - 1] > 0 ? index[T - 1] ** (1 / years) - 1 : 0;
  const volatility = std(rs) * Math.sqrt(TRADING_DAYS);
  const rfDaily = riskFree / TRADING_DAYS;
  const excess = mean(rs) - rfDaily;
  const sharpe = volatility > 0 ? (excess * TRADING_DAYS) / volatility : null;
  let downside = 0;
  for (const x of rs) downside += Math.min(x - rfDaily, 0) ** 2;
  downside = Math.sqrt(downside / Math.max(rs.length, 1)) * Math.sqrt(TRADING_DAYS);
  const sortino = downside > 0 ? (excess * TRADING_DAYS) / downside : null;
  const { max, longestDays } = drawdowns(dates, index);
  const calmar = max && max.depth < 0 ? cagr / -max.depth : null;

  let beta: number | null = null;
  let alpha: number | null = null;
  if (benchmark) {
    const rb = dailyReturns(benchmark, new Float64Array(T)).subarray(1);
    const mb = mean(rb);
    const ma = mean(rs);
    let cov = 0;
    let varB = 0;
    for (let i = 0; i < rs.length; i++) {
      cov += (rs[i] - ma) * (rb[i] - mb);
      varB += (rb[i] - mb) ** 2;
    }
    if (varB > 0) {
      beta = cov / varB;
      alpha = (ma - rfDaily - beta * (mb - rfDaily)) * TRADING_DAYS;
    }
  }

  const monthlyReturns: { month: string; return: number }[] = [];
  for (let t = 1; t < T; t++) {
    const month = dates[t].slice(0, 7);
    const last = monthlyReturns.at(-1);
    if (last?.month === month) last.return = (1 + last.return) * (1 + r[t]) - 1;
    else monthlyReturns.push({ month, return: r[t] });
  }
  const positiveMonths = monthlyReturns.length
    ? monthlyReturns.filter((m) => m.return > 0).length / monthlyReturns.length
    : null;

  let bought = 0;
  let sold = 0;
  for (const tr of sim.trades as Trade[]) {
    const notional = tr.shares * tr.price;
    if (notional > 0) bought += notional;
    else sold -= notional;
  }
  const avgEquity = mean(sim.equity);
  const turnover = years > 0 && avgEquity > 0 ? Math.min(bought, sold) / avgEquity / years : 0;

  let netContributions = initialCash;
  for (const f of sim.flows) netContributions += f;

  return {
    startDate: dates[0],
    endDate: dates[T - 1],
    finalEquity: sim.equity[T - 1],
    netContributions,
    totalReturn,
    cagr,
    volatility,
    sharpe,
    sortino,
    calmar,
    maxDrawdown: max,
    longestDrawdownDays: longestDays,
    beta,
    alpha,
    positiveMonths,
    monthlyReturns,
    turnover,
    costsPaid: sim.costsPaid,
    dividendsReceived: sim.dividendsReceived,
    trades: sim.trades.length,
  };
}
