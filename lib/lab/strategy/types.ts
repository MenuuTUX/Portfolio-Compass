import type { BarSeries } from "@/lib/lab/bar-types";

// Messages and results shared by the strategy workers and the page.

export type StrategyLanguage = "python" | "typescript";

/** Plain values a params panel can edit. */
export type ParamValue = number | boolean | string;
export type Params = Record<string, ParamValue>;

/** What a strategy sees: adjusted closes as rows (dates) × columns (tickers), NaN where a ticker has no bar. */
export interface PriceMatrix {
  dates: string[];
  tickers: string[];
  /** Row-major, index `t * tickers.length + j`. */
  adjClose: Float64Array;
}

export interface StrategyError {
  message: string;
  /** 1-based line in the user's file, when it could be located. */
  line?: number;
}

export interface LookaheadResult {
  /** True when weights before a cut-off changed once later prices were removed. */
  leaks: boolean;
  /** First date whose weights changed. */
  firstDate?: string;
  /** Cut-off dates tested. */
  cutoffs: string[];
}

export type StrategyResult =
  /** `weights` is row-major over `dates` × `tickers`: the strategy's own universe, which the engine maps onto its frame. */
  | { ok: true; weights: Float64Array; dates: string[]; tickers: string[]; logs: string[]; lookahead: LookaheadResult; ms: number }
  | { ok: false; error: StrategyError; logs: string[] };

export type StrategyRequest =
  /** The worker builds the price matrix from the series exactly as the engine will. */
  | { id: number; op: "run"; code: string; params: Params; series: BarSeries[]; baseCurrency: string }
  | { id: number; op: "inspect"; code: string };

export type StrategyResponse =
  | { id: number; op: "run"; result: StrategyResult }
  | { id: number; op: "inspect"; params: Params | null; error?: StrategyError }
  /** Progress while Python loads; `id` is -1. */
  | { id: number; op: "status"; message: string };

/** Keep only values a form can edit; drop functions, objects and non-finite numbers. */
export function cleanParams(raw: unknown): Params {
  const out: Params = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) {
    if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean" || typeof v === "string") out[k] = v;
  }
  return out;
}

export const MAX_LOG_LINES = 500;
