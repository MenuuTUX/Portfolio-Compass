// Helpers available to TypeScript strategies as `ctx.*`. Every helper looks
// backwards only: the value at index t uses data at t and before. NaN marks
// "not enough history yet".

export type Series = Float64Array;

export function returns(x: ArrayLike<number>, n = 1): Series {
  const out = new Float64Array(x.length).fill(NaN);
  for (let t = n; t < x.length; t++) out[t] = x[t] / x[t - n] - 1;
  return out;
}

/**
 * Simple moving average of the last n prices that exist. A missing price
 * (another exchange's holiday in a mixed universe) is skipped, not counted,
 * and its own slot is NaN. NaN until n prices exist.
 */
export function sma(x: ArrayLike<number>, n: number): Series {
  const out = new Float64Array(x.length).fill(NaN);
  const window: number[] = [];
  let sum = 0;
  for (let t = 0; t < x.length; t++) {
    if (Number.isNaN(x[t])) continue;
    window.push(x[t]);
    sum += x[t];
    if (window.length > n) sum -= window.shift()!;
    if (window.length === n) out[t] = sum / n;
  }
  return out;
}

export function ema(x: ArrayLike<number>, n: number): Series {
  const out = new Float64Array(x.length).fill(NaN);
  const k = 2 / (n + 1);
  let prev = NaN;
  let seen = 0;
  for (let t = 0; t < x.length; t++) {
    if (Number.isNaN(x[t])) continue;
    seen++;
    prev = Number.isNaN(prev) ? x[t] : x[t] * k + prev * (1 - k);
    if (seen >= n) out[t] = prev;
  }
  return out;
}

/** Rolling sample standard deviation of the last n values. */
export function stdev(x: ArrayLike<number>, n: number): Series {
  const out = new Float64Array(x.length).fill(NaN);
  for (let t = n - 1; t < x.length; t++) {
    let mean = 0;
    let ok = true;
    for (let i = t - n + 1; i <= t; i++) {
      if (Number.isNaN(x[i])) ok = false;
      mean += x[i];
    }
    if (!ok) continue;
    mean /= n;
    let s = 0;
    for (let i = t - n + 1; i <= t; i++) s += (x[i] - mean) ** 2;
    out[t] = Math.sqrt(s / (n - 1));
  }
  return out;
}

/** Wilder's relative strength index. */
export function rsi(x: ArrayLike<number>, n = 14): Series {
  const out = new Float64Array(x.length).fill(NaN);
  let gain = 0;
  let loss = 0;
  for (let t = 1; t < x.length; t++) {
    const d = x[t] - x[t - 1];
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    if (t <= n) {
      gain += g / n;
      loss += l / n;
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
    }
    if (t >= n) out[t] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/**
 * Equal weights on the `n` highest scores in each row; ties go to the earlier
 * ticker. Rows with fewer than n valid scores weight only the valid ones.
 * `scores` is row-major T × N like the price matrix.
 */
export function topN(scores: Float64Array, columns: number, n: number): Float64Array {
  const rows = scores.length / columns;
  const out = new Float64Array(scores.length);
  for (let t = 0; t < rows; t++) {
    const ranked: number[] = [];
    for (let j = 0; j < columns; j++) if (!Number.isNaN(scores[t * columns + j])) ranked.push(j);
    ranked.sort((a, b) => scores[t * columns + b] - scores[t * columns + a]);
    for (const j of ranked.slice(0, n)) out[t * columns + j] = 1 / n;
  }
  return out;
}
