// Type declarations the editor loads for TypeScript strategies (autocomplete
// and inline docs). Keep in step with pricesView and context in ts-runner.ts.

export const STRATEGY_API_DTS = `
/** Adjusted closes for the universe. Index t is a trading date; NaN where a ticker had no bar. */
interface Prices {
  /** Trading dates, oldest first, YYYY-MM-DD. */
  readonly dates: string[];
  /** The universe, in the order you entered it. */
  readonly tickers: string[];
  /** Number of dates. */
  readonly length: number;
  /** Row-major dates × tickers matrix: matrix[t * tickers.length + j]. */
  readonly matrix: Float64Array;
  /** One ticker's adjusted closes, oldest first. */
  col(ticker: string): Float64Array;
}

type ParamValue = number | boolean | string;

/** Helpers that only look backwards: the value at t uses data at t and before. NaN until enough history exists. */
interface Context {
  /** Your exported params, with any values edited in the params panel. */
  readonly params: Record<string, ParamValue>;
  /** Return over the last n bars (default 1). */
  returns(x: ArrayLike<number>, n?: number): Float64Array;
  /** Average of the last n prices that exist; gaps are skipped. */
  sma(x: ArrayLike<number>, n: number): Float64Array;
  ema(x: ArrayLike<number>, n: number): Float64Array;
  /** Rolling sample standard deviation. */
  stdev(x: ArrayLike<number>, n: number): Float64Array;
  /** Wilder's RSI (default 14). */
  rsi(x: ArrayLike<number>, n?: number): Float64Array;
  /** Equal weights (1/n) on the n highest scores each day. One score series per ticker. */
  topN(scores: Record<string, ArrayLike<number>>, n: number): Float64Array;
}

/**
 * Target weights per date, as fractions (0.25 = 25%). Rows may sum to less than 1; the rest is cash.
 * Any of: rows of { TICKER: weight }, rows of numbers in ticker order, { TICKER: series }, or a flat matrix.
 * NaN means no position. The engine trades at the next bar, never the bar the weights were computed on.
 */
type Weights =
  | Record<string, number>[]
  | ArrayLike<number>[]
  | Record<string, ArrayLike<number>>
  | Float64Array;
`;
