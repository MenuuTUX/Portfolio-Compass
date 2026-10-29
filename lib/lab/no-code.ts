import type { Frame } from "@/lib/lab/engine/frame";

// No-code strategies for Compass Lab. Each compiles to a target-weight matrix
// for the engine, using only data up to each bar (the engine fills at t+1).
// Signals use adjusted-close ratios, never price levels; see the Phase 2 notes
// in docs/backtesting-lab-plan.md.

export type NoCodeStrategy =
  | { kind: "fixed"; allocation: Record<string, number> }
  /** Hold each asset only while its adjusted close is above its moving average; otherwise move that weight to `safe` or cash. */
  | { kind: "trend"; allocation: Record<string, number>; smaDays: number; safe?: string }
  /** Equal-weight the `top` assets by trailing return; with `absolute`, an asset with a negative return goes to `safe` or cash instead. */
  | { kind: "momentum"; universe: string[]; lookbackDays: number; top: number; absolute: boolean; safe?: string };

export function strategyTickers(s: NoCodeStrategy): string[] {
  const own = s.kind === "momentum" ? s.universe : Object.keys(s.allocation);
  const safe = s.kind === "fixed" ? undefined : s.safe;
  return [...new Set([...own, ...(safe ? [safe] : [])])];
}

function column(frame: Frame, ticker: string): number {
  const j = frame.tickers.indexOf(ticker);
  if (j === -1) throw new Error(`${ticker} is in the strategy but not in the data`);
  return j;
}

export function compileStrategy(frame: Frame, s: NoCodeStrategy): Float64Array {
  const T = frame.dates.length;
  const N = frame.tickers.length;
  const out = new Float64Array(T * N);
  const px = (t: number, j: number) => frame.adjClose[t * N + j];

  if (s.kind === "fixed") {
    for (const [ticker, w] of Object.entries(s.allocation)) {
      const j = column(frame, ticker);
      for (let t = 0; t < T; t++) out[t * N + j] = w;
    }
    return out;
  }

  const safe = s.safe ? column(frame, s.safe) : -1;

  if (s.kind === "trend") {
    if (!(s.smaDays >= 2)) throw new Error("The moving average needs at least 2 days");
    for (const [ticker, w] of Object.entries(s.allocation)) {
      const j = column(frame, ticker);
      // Rolling sum over the last smaDays bars that have a price.
      const window: number[] = [];
      let sum = 0;
      for (let t = 0; t < T; t++) {
        const p = px(t, j);
        if (!Number.isNaN(p)) {
          window.push(p);
          sum += p;
          if (window.length > s.smaDays) sum -= window.shift()!;
        }
        // Before a full window there is no signal, so the asset is held as allocated.
        const above = window.length < s.smaDays || Number.isNaN(p) || p > sum / s.smaDays;
        if (above) out[t * N + j] += w;
        else if (safe !== -1) out[t * N + safe] += w;
      }
    }
    return out;
  }

  if (!(s.lookbackDays >= 1) || !(s.top >= 1)) throw new Error("Lookback and number of holdings must be at least 1");
  const cols = s.universe.map((ticker) => column(frame, ticker));
  for (let t = s.lookbackDays; t < T; t++) {
    const ranked = cols
      .map((j) => ({ j, r: px(t, j) / px(t - s.lookbackDays, j) - 1 }))
      .filter((x) => Number.isFinite(x.r))
      .sort((a, b) => b.r - a.r)
      .slice(0, s.top);
    for (const { j, r } of ranked) {
      const target = s.absolute && r < 0 ? safe : j;
      if (target !== -1) out[t * N + target] += 1 / s.top;
    }
  }
  return out;
}
