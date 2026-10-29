import { transform } from "sucrase";
import * as ind from "@/lib/lab/strategy/indicators";
import { normalizeWeights } from "@/lib/lab/strategy/weights";
import { cleanParams, MAX_LOG_LINES, type Params, type PriceMatrix, type StrategyError } from "@/lib/lab/strategy/types";

// Runs a TypeScript strategy. Sucrase strips types without moving code
// between lines, so error positions map straight back to the editor.

export interface LogSink {
  lines: string[];
}

function format(value: unknown): string {
  if (typeof value === "string") return value;
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const arr = Array.from(value as unknown as ArrayLike<number>);
    return `[${arr.slice(0, 20).map((v) => (Number.isInteger(v) ? v : Number(v.toPrecision(6)))).join(", ")}${arr.length > 20 ? `, … ${arr.length - 20} more` : ""}]`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sinkConsole(sink: LogSink) {
  const push = (prefix: string) => (...args: unknown[]) => {
    if (sink.lines.length < MAX_LOG_LINES) sink.lines.push(prefix + args.map(format).join(" "));
    else if (sink.lines.length === MAX_LOG_LINES) sink.lines.push(`… output stopped after ${MAX_LOG_LINES} lines`);
  };
  return { log: push(""), info: push(""), debug: push(""), warn: push("warning: "), error: push("error: ") };
}

const FILE = "strategy.ts";

/** Lines the Function constructor adds above the body, measured once because engines differ. */
let headerLines: number | null = null;
function bodyLineOffset(): number {
  if (headerLines === null) {
    try {
      new Function(`throw new Error("probe")\n//# sourceURL=probe.ts`)();
    } catch (e) {
      const m = String((e as Error).stack).match(/probe\.ts:(\d+)/);
      headerLines = m ? Number(m[1]) - 1 : 2;
    }
  }
  return headerLines ?? 2;
}

/** Map an error from compiling or running the strategy to a message and an editor line. */
export function locateError(error: unknown): StrategyError {
  const e = error instanceof Error ? error : new Error(String(error));
  // Sucrase syntax errors end with "(line:column)".
  const syntax = e.message.match(/\((\d+):(\d+)\)\s*$/);
  if (syntax) return { message: e.message.replace(/\s*\(\d+:\d+\)\s*$/, ""), line: Number(syntax[1]) };
  const frame = String(e.stack ?? "").match(new RegExp(`${FILE.replace(".", "\\.")}:(\\d+)`));
  return { message: e.message, ...(frame ? { line: Number(frame[1]) - bodyLineOffset() } : {}) };
}

export interface TsModule {
  weights: (prices: unknown, ctx: unknown) => unknown;
  params: Params;
}

/** Strip types and convert exports. Throws a syntax error with "(line:column)". */
export function compileTypeScript(code: string): string {
  return transform(code, { transforms: ["typescript", "imports"], production: true }).code;
}

/** Evaluate compiled strategy code with its own console. */
export function instantiate(js: string, sink: LogSink): TsModule {
  const exports: Record<string, unknown> = {};
  const require = (name: string) => {
    throw new Error(`Imports are not available in strategies ("${name}"). Use the helpers on ctx instead.`);
  };
  new Function("exports", "require", "console", `${js}\n//# sourceURL=${FILE}`)(exports, require, sinkConsole(sink));
  const weights = (exports.weights ?? exports.default) as TsModule["weights"] | undefined;
  if (typeof weights !== "function") throw new Error("Export a function named weights(prices, ctx).");
  return { weights, params: cleanParams(exports.params) };
}

export function loadTypeScript(code: string, sink: LogSink): TsModule {
  return instantiate(compileTypeScript(code), sink);
}

/** The `prices` object a strategy receives. */
export function pricesView(p: PriceMatrix) {
  const N = p.tickers.length;
  const cols = new Map<string, Float64Array>();
  return {
    dates: p.dates,
    tickers: p.tickers,
    length: p.dates.length,
    matrix: p.adjClose,
    col(ticker: string): Float64Array {
      const j = p.tickers.indexOf(ticker);
      if (j === -1) throw new Error(`${ticker} is not in the universe (${p.tickers.join(", ")})`);
      let c = cols.get(ticker);
      if (!c) {
        c = new Float64Array(p.dates.length);
        for (let t = 0; t < c.length; t++) c[t] = p.adjClose[t * N + j];
        cols.set(ticker, c);
      }
      return c;
    },
  };
}

function context(p: PriceMatrix, params: Params) {
  const N = p.tickers.length;
  return {
    params,
    returns: ind.returns,
    sma: ind.sma,
    ema: ind.ema,
    stdev: ind.stdev,
    rsi: ind.rsi,
    /** Equal-weight the n best scores each day. Takes one series per ticker. */
    topN(scores: Record<string, ArrayLike<number>>, n: number) {
      const m = new Float64Array(p.dates.length * N).fill(NaN);
      p.tickers.forEach((ticker, j) => {
        const s = scores[ticker];
        if (s) for (let t = 0; t < p.dates.length; t++) m[t * N + j] = s[t];
      });
      return ind.topN(m, N, n);
    },
  };
}

/** Compute weights for one price history; params are the module's defaults overlaid with `overrides`. */
export function computeTsWeights(mod: TsModule, prices: PriceMatrix, overrides: Params): Float64Array {
  const out = mod.weights(pricesView(prices), context(prices, { ...mod.params, ...overrides }));
  return normalizeWeights(out, prices);
}
