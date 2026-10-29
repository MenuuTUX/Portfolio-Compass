import type { LookaheadResult, PriceMatrix } from "@/lib/lab/strategy/types";

// Turning whatever a strategy returns into the engine's weight matrix, and the
// lookahead check that works for any language.

/**
 * Accepts the shapes a strategy can reasonably return and produces a
 * row-major T × N matrix. NaN means "no position" (warm-up periods), so it
 * becomes 0 here; the engine still rejects negatives and leverage.
 */
export function normalizeWeights(out: unknown, prices: PriceMatrix): Float64Array {
  const T = prices.dates.length;
  const N = prices.tickers.length;
  const w = new Float64Array(T * N);
  const put = (t: number, j: number, v: unknown) => {
    const x = Number(v);
    w[t * N + j] = Number.isNaN(x) ? 0 : x;
  };

  if (out instanceof Float64Array || (Array.isArray(out) && typeof out[0] === "number")) {
    const flat = out as ArrayLike<number>;
    if (flat.length !== T * N) throw new Error(`weights() returned ${flat.length} numbers; expected ${T} dates × ${N} tickers = ${T * N}`);
    for (let i = 0; i < flat.length; i++) put(Math.floor(i / N), i % N, flat[i]);
    return w;
  }
  if (Array.isArray(out)) {
    if (out.length !== T) throw new Error(`weights() returned ${out.length} rows; expected one per date (${T})`);
    out.forEach((row, t) => {
      if (Array.isArray(row) || ArrayBuffer.isView(row)) {
        const r = row as ArrayLike<number>;
        if (r.length !== N) throw new Error(`Row ${t} of weights() has ${r.length} values; expected ${N} (one per ticker)`);
        for (let j = 0; j < N; j++) put(t, j, r[j]);
      } else if (row && typeof row === "object") {
        prices.tickers.forEach((ticker, j) => put(t, j, (row as Record<string, number>)[ticker] ?? 0));
      } else {
        throw new Error(`Row ${t} of weights() is not an array or an object`);
      }
    });
    return w;
  }
  if (out && typeof out === "object") {
    // One column per ticker.
    const cols = out as Record<string, ArrayLike<number>>;
    for (const key of Object.keys(cols)) {
      if (!prices.tickers.includes(key)) throw new Error(`weights() has a column for ${key}, which is not in the universe`);
    }
    prices.tickers.forEach((ticker, j) => {
      const col = cols[ticker];
      if (!col) return;
      if (col.length !== T) throw new Error(`weights().${ticker} has ${col.length} values; expected ${T}`);
      for (let t = 0; t < T; t++) put(t, j, col[t]);
    });
    return w;
  }
  throw new Error("weights() must return a matrix, rows, or columns of numbers");
}

/** The first `rows` dates of a price matrix, as if later prices did not exist yet. */
export function truncatePrices(prices: PriceMatrix, rows: number): PriceMatrix {
  return {
    dates: prices.dates.slice(0, rows),
    tickers: prices.tickers,
    adjClose: prices.adjClose.slice(0, rows * prices.tickers.length),
  };
}

/** Cut-off points for the lookahead check: 60% and 85% of the way through. */
export function lookaheadCutoffs(T: number): number[] {
  return [...new Set([Math.floor(T * 0.6), Math.floor(T * 0.85)])].filter((c) => c >= 2 && c < T);
}

/**
 * Compare the full-history weights with weights computed when history stops
 * at each cut-off. A strategy that only looks backwards gives identical rows
 * before the cut-off; any difference means it read future prices.
 */
export function compareForLookahead(
  prices: PriceMatrix,
  full: Float64Array,
  cut: number,
  truncated: Float64Array,
): number | null {
  const N = prices.tickers.length;
  for (let t = 0; t < cut; t++) {
    for (let j = 0; j < N; j++) {
      if (Math.abs(full[t * N + j] - truncated[t * N + j]) > 1e-9) return t;
    }
  }
  return null;
}

export async function checkLookahead(
  prices: PriceMatrix,
  full: Float64Array,
  compute: (p: PriceMatrix) => Promise<Float64Array> | Float64Array,
): Promise<LookaheadResult> {
  const cutoffs = lookaheadCutoffs(prices.dates.length);
  let first: number | null = null;
  for (const cut of cutoffs) {
    const truncated = await compute(truncatePrices(prices, cut));
    const t = compareForLookahead(prices, full, cut, truncated);
    if (t !== null && (first === null || t < first)) first = t;
  }
  return {
    leaks: first !== null,
    ...(first !== null ? { firstDate: prices.dates[first] } : {}),
    cutoffs: cutoffs.map((c) => prices.dates[c - 1]),
  };
}
