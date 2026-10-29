import type { Frame } from "@/lib/lab/engine/frame";

// The Compass Lab simulator. Strategies only supply target weights; this file
// owns cash, fills, costs, dividends and rebalancing, so every strategy
// language gets identical accounting.
//
// Timing: the target row for bar t may use data up to t's close. Orders from
// it fill at bar t+1 (open or close), never at bar t, so a strategy cannot
// trade on a price it has already seen.
//
// Prices are split-adjusted (Yahoo `close`), so share counts are in today's
// share units and splits need no events. Dividends are paid as cash on the
// ex-date to shares held at the prior close.

export type Period = "W" | "M" | "Q" | "Y";

export interface BacktestConfig {
  initialCash: number;
  fill: "next-open" | "next-close";
  costs: { commissionBps: number; minCommission: number; slippageBps: number };
  shares: "fractional" | "whole";
  dividends: "reinvest" | "cash";
  rebalance:
    | { mode: "on-change" }
    | { mode: "calendar"; every: Period }
    | { mode: "drift"; band: number };
  /** Added (or withdrawn when negative) on the first bar of each period, then invested at target weights. */
  cashFlow?: { amount: number; every: Exclude<Period, "W"> };
}

export const DEFAULT_CONFIG: BacktestConfig = {
  initialCash: 100_000,
  fill: "next-open",
  costs: { commissionBps: 0, minCommission: 0, slippageBps: 5 },
  shares: "fractional",
  dividends: "reinvest",
  rebalance: { mode: "on-change" },
};

export interface Trade {
  date: string;
  ticker: string;
  /** Positive for a buy, negative for a sell. */
  shares: number;
  /** Fill price including slippage. */
  price: number;
  commission: number;
}

export interface SimResult {
  /** Portfolio value at each close. */
  equity: Float64Array;
  cash: Float64Array;
  /** External cash added (+) or withdrawn (−) at each bar. */
  flows: Float64Array;
  /** Shares held at each close, row-major like the frame. */
  holdings: Float64Array;
  trades: Trade[];
  dividendsReceived: number;
  costsPaid: number;
  warnings: string[];
}

const EPS = 1e-9;

export function periodKey(date: string, every: Period): string {
  switch (every) {
    case "Y":
      return date.slice(0, 4);
    case "Q":
      return `${date.slice(0, 4)}Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3)}`;
    case "M":
      return date.slice(0, 7);
    case "W": {
      // Monday of the ISO week, so weeks that span a month or year stay whole.
      const d = new Date(`${date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    }
  }
}

/** Validate one row of targets in place: NaN means 0; shorts and leverage are rejected. */
function checkRow(targets: Float64Array, t: number, frame: Frame, warnings: Set<string>) {
  const N = frame.tickers.length;
  let sum = 0;
  for (let j = 0; j < N; j++) {
    const w = targets[t * N + j];
    if (Number.isNaN(w)) {
      targets[t * N + j] = 0;
      warnings.add("Some target weights were NaN and were treated as 0.");
      continue;
    }
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`Weight for ${frame.tickers[j]} on ${frame.dates[t]} is ${w}; weights must be 0 or more`);
    }
    sum += w;
  }
  if (sum > 1 + 1e-6) {
    throw new Error(`Weights on ${frame.dates[t]} sum to ${sum.toFixed(4)}; leverage is not supported`);
  }
}

export function simulate(frame: Frame, targetsIn: Float64Array, config: BacktestConfig): SimResult {
  const { dates, tickers } = frame;
  const T = dates.length;
  const N = tickers.length;
  if (targetsIn.length !== T * N) {
    throw new Error(`Targets have ${targetsIn.length} values; expected ${T} dates × ${N} tickers`);
  }
  if (!(config.initialCash > 0)) throw new Error("Initial cash must be positive");

  const targets = Float64Array.from(targetsIn);
  const fillPrices = config.fill === "next-open" ? frame.open : frame.close;
  const slip = config.costs.slippageBps / 1e4;
  const commission = (notional: number) =>
    notional > EPS ? Math.max(config.costs.minCommission, (notional * config.costs.commissionBps) / 1e4) : 0;

  const equity = new Float64Array(T);
  const cashOut = new Float64Array(T);
  const flows = new Float64Array(T);
  const holdings = new Float64Array(T * N);
  const trades: Trade[] = [];
  const warnings = new Set<string>();

  let cash = config.initialCash;
  const shares = new Float64Array(N);
  const lastClose = new Float64Array(N).fill(NaN);
  const pendingReinvest = new Float64Array(N);
  let dividendsReceived = 0;
  let costsPaid = 0;
  let rebalanceDue = false;
  let invested = false;

  const roundShares = (s: number) => (config.shares === "whole" ? Math.floor(s + EPS) : s);

  const trade = (t: number, j: number, delta: number, price: number) => {
    if (Math.abs(delta) < EPS) return;
    const px = delta > 0 ? price * (1 + slip) : price * (1 - slip);
    const fee = commission(Math.abs(delta) * px);
    shares[j] += delta;
    cash -= delta * px + fee;
    costsPaid += fee + Math.abs(delta) * price * slip;
    trades.push({ date: dates[t], ticker: tickers[j], shares: delta, price: px, commission: fee });
  };

  /** Largest buy of `wanted` shares that `budget` covers after slippage and commission. */
  const affordable = (wanted: number, price: number, budget: number) => {
    const px = price * (1 + slip);
    let s = roundShares(Math.min(wanted, budget / px));
    while (s > EPS && s * px + commission(s * px) > budget + EPS) {
      s = config.shares === "whole" ? s - 1 : roundShares((budget - commission(s * px)) / px);
    }
    return Math.max(0, s);
  };

  const rebalance = (t: number, row: number) => {
    let value = cash;
    for (let j = 0; j < N; j++) {
      const p = fillPrices[t * N + j];
      value += shares[j] * (Number.isNaN(p) ? lastClose[j] || 0 : p);
    }
    const want = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      const p = fillPrices[t * N + j];
      const w = targets[row * N + j];
      if (Number.isNaN(p)) {
        want[j] = shares[j];
        if (w > 0) {
          warnings.add(Number.isNaN(lastClose[j])
            ? `${tickers[j]} had a target weight before its first bar; that share stayed in cash.`
            : `${tickers[j]} had no bar on a rebalance date; its position was left unchanged.`);
        }
        continue;
      }
      want[j] = roundShares((w * value) / p);
    }
    for (let j = 0; j < N; j++) {
      if (want[j] < shares[j] - EPS) trade(t, j, want[j] - shares[j], fillPrices[t * N + j]);
    }
    // Buy in order of size so rounding and fees fall on the smallest positions.
    const buys = [...Array(N).keys()]
      .filter((j) => want[j] > shares[j] + EPS)
      .sort((a, b) => (want[b] - shares[b]) * fillPrices[t * N + b] - (want[a] - shares[a]) * fillPrices[t * N + a]);
    for (const j of buys) {
      const p = fillPrices[t * N + j];
      trade(t, j, affordable(want[j] - shares[j], p, cash), p);
    }
    pendingReinvest.fill(0);
  };

  for (let t = 0; t < T; t++) {
    // 1. Dividends go to shares held at the previous close.
    for (let j = 0; j < N; j++) {
      const d = frame.dividend[t * N + j];
      if (d > 0 && shares[j] > EPS) {
        cash += shares[j] * d;
        dividendsReceived += shares[j] * d;
        if (config.dividends === "reinvest") pendingReinvest[j] += shares[j] * d;
      }
    }

    // 2. External cash flows on the first bar of each period.
    const cf = config.cashFlow;
    if (cf && t > 0 && periodKey(dates[t], cf.every) !== periodKey(dates[t - 1], cf.every)) {
      // A withdrawal can draw cash negative; the rebalance below sells to cover it.
      let worth = cash;
      for (let j = 0; j < N; j++) worth += shares[j] * (lastClose[j] || 0);
      const amount = Math.max(cf.amount, -worth);
      if (amount > cf.amount) warnings.add("A withdrawal was larger than the portfolio and was reduced.");
      cash += amount;
      flows[t] = amount;
      if (invested) rebalanceDue = true;
    }

    // 3. Orders decided at t-1 fill now.
    if (t > 0 && rebalanceDue) {
      rebalance(t, t - 1);
      rebalanceDue = false;
    } else {
      for (let j = 0; j < N; j++) {
        const p = fillPrices[t * N + j];
        if (pendingReinvest[j] > EPS && !Number.isNaN(p)) {
          trade(t, j, affordable(Infinity, p, Math.min(pendingReinvest[j], cash)), p);
          pendingReinvest[j] = 0;
        }
      }
    }

    // 4. Mark to market at the close.
    let value = cash;
    for (let j = 0; j < N; j++) {
      const c = frame.close[t * N + j];
      if (!Number.isNaN(c)) lastClose[j] = c;
      if (shares[j] !== 0) value += shares[j] * lastClose[j];
      holdings[t * N + j] = shares[j];
    }
    equity[t] = value;
    cashOut[t] = cash;

    // 5. Decide whether this bar's targets trigger orders for t+1.
    checkRow(targets, t, frame, warnings);
    let changed = false;
    for (let j = 0; j < N; j++) {
      const prev = t > 0 ? targets[(t - 1) * N + j] : 0;
      if (Math.abs(targets[t * N + j] - prev) > EPS) changed = true;
    }
    let hasTargets = false;
    for (let j = 0; j < N; j++) if (targets[t * N + j] > 0) hasTargets = true;

    const rule = config.rebalance;
    if (!invested) {
      if (hasTargets) rebalanceDue = invested = true;
    } else if (rule.mode === "on-change") {
      if (changed) rebalanceDue = true;
    } else if (rule.mode === "calendar") {
      if (t + 1 < T && periodKey(dates[t], rule.every) !== periodKey(dates[t + 1], rule.every)) rebalanceDue = true;
    } else if (changed) {
      rebalanceDue = true;
    } else if (value > 0) {
      for (let j = 0; j < N; j++) {
        const held = (shares[j] * (lastClose[j] || 0)) / value;
        if (Math.abs(held - targets[t * N + j]) > rule.band) rebalanceDue = true;
      }
    }
  }

  return {
    equity,
    cash: cashOut,
    flows,
    holdings,
    trades,
    dividendsReceived,
    costsPaid,
    warnings: [...warnings],
  };
}
