import { parseTickers } from "@/lib/tickers";
import type { BacktestConfig, Period } from "@/lib/lab/engine/simulate";
import { strategyTickers, type NoCodeStrategy } from "@/lib/lab/no-code";
import { CODE_TEMPLATES } from "@/lib/lab/strategy/templates";
import type { Params, StrategyLanguage } from "@/lib/lab/strategy/types";

// The Compass Lab form: what the user edits (a no-code rule or code), the
// built-in templates, and the conversion into an engine request.

/** Browser storage the Lab writes, listed on /privacy and cleared from Settings. */
export const LAB_ACK_KEY = "pc:lab-ack:v1";
export const LAB_FORM_KEY = "pc:lab-form:v1";

/** Largest universe the form accepts; keeps a cold load well inside the API's 120 requests per minute. */
export const MAX_UNIVERSE = 50;

export type StrategyKind = NoCodeStrategy["kind"];
export type RebalanceChoice = "on-change" | Period | "drift";

export interface AllocationRow {
  ticker: string;
  /** Percent, 0 to 100. */
  weight: number;
}

export interface LabForm {
  name: string;
  mode: "no-code" | "code";
  /** Code mode: language, source, edited params, and the saved strategy it came from. */
  language: StrategyLanguage;
  code: string;
  /** Tickers the code receives; separate from `rows` so switching modes never changes a no-code rule. */
  universe: string[];
  paramOverrides: Params;
  strategyId: string | null;
  kind: StrategyKind;
  rows: AllocationRow[];
  smaDays: number;
  lookbackDays: number;
  top: number;
  absolute: boolean;
  /** Where weight goes when a rule steps out; blank means cash. */
  safe: string;
  start: string;
  end: string;
  benchmark: string;
  initialCash: number;
  rebalance: RebalanceChoice;
  /** Drift band in percentage points. */
  band: number;
  contribution: number;
  contributionEvery: "M" | "Q" | "Y";
  slippageBps: number;
  commissionBps: number;
  minCommission: number;
  shares: BacktestConfig["shares"];
  dividends: BacktestConfig["dividends"];
  fill: BacktestConfig["fill"];
}

const today = () => new Date().toISOString().slice(0, 10);

export const BLANK_FORM: LabForm = {
  name: "Untitled strategy",
  mode: "no-code",
  language: "python",
  code: CODE_TEMPLATES[0].python,
  universe: CODE_TEMPLATES[0].universe,
  paramOverrides: {},
  strategyId: null,
  kind: "fixed",
  rows: [{ ticker: "SPY", weight: 100 }],
  smaDays: 200,
  lookbackDays: 252,
  top: 1,
  absolute: true,
  safe: "",
  start: "2010-01-01",
  end: today(),
  benchmark: "SPY",
  initialCash: 10_000,
  rebalance: "on-change",
  band: 5,
  contribution: 0,
  contributionEvery: "M",
  slippageBps: 5,
  commissionBps: 0,
  minCommission: 0,
  shares: "fractional",
  dividends: "reinvest",
  fill: "next-open",
};

export interface Template {
  id: string;
  label: string;
  description: string;
  form: () => Partial<LabForm>;
}

export const TEMPLATES: Template[] = [
  {
    id: "60-40",
    label: "60/40 with a 5% band",
    description: "60% US stocks, 40% US bonds. Rebalances when either drifts more than 5 points.",
    form: () => ({
      name: "60/40 with a 5% band",
      kind: "fixed",
      rows: [{ ticker: "SPY", weight: 60 }, { ticker: "AGG", weight: 40 }],
      rebalance: "drift",
      band: 5,
    }),
  },
  {
    id: "trend",
    label: "200-day trend filter",
    description: "Holds SPY above its 200-day average and short-term Treasuries below it. Checked monthly.",
    form: () => ({
      name: "200-day trend filter",
      kind: "trend",
      rows: [{ ticker: "SPY", weight: 100 }],
      smaDays: 200,
      safe: "SHY",
      rebalance: "M",
    }),
  },
  {
    id: "dual-momentum",
    label: "Dual momentum",
    description: "Holds whichever of US or international stocks rose more over 12 months, or bonds if neither rose. Monthly.",
    form: () => ({
      name: "Dual momentum",
      kind: "momentum",
      rows: [{ ticker: "SPY", weight: 0 }, { ticker: "EFA", weight: 0 }],
      lookbackDays: 252,
      top: 1,
      absolute: true,
      safe: "AGG",
      rebalance: "M",
    }),
  },
  {
    id: "three-fund",
    label: "Three-fund portfolio",
    description: "US stocks, international stocks and bonds, rebalanced once a year.",
    form: () => ({
      name: "Three-fund portfolio",
      kind: "fixed",
      rows: [{ ticker: "VTI", weight: 50 }, { ticker: "VXUS", weight: 30 }, { ticker: "BND", weight: 20 }],
      start: "2012-01-01",
      rebalance: "Y",
    }),
  },
];

export type PortfolioBasis = "value" | "target" | "equal";

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * The user's saved holdings as allocation rows, in the same priority the
 * Portfolio tab uses: market value (shares × latest close) when every holding
 * has shares and a price, then target weights, then equal weights.
 */
export function rowsFromPortfolio(
  items: { ticker: string; weight: number; shares: number }[],
  lastClose: Record<string, number> = {},
): { rows: AllocationRow[]; basis: PortfolioBasis } {
  const held = items.filter((i) => i.ticker).map((i) => ({ ...i, ticker: i.ticker.toUpperCase() }));
  if (held.length === 0) return { rows: [], basis: "equal" };

  const values = held.map((i) => i.shares * (lastClose[i.ticker] ?? NaN));
  const totalValue = values.reduce((s, v) => s + v, 0);
  if (held.every((i) => i.shares > 0) && Number.isFinite(totalValue) && totalValue > 0) {
    return { rows: held.map((i, k) => ({ ticker: i.ticker, weight: round2((values[k] / totalValue) * 100) })), basis: "value" };
  }

  const totalWeight = held.reduce((s, i) => s + (i.weight > 0 ? i.weight : 0), 0);
  if (totalWeight > 0) {
    return { rows: held.map((i) => ({ ticker: i.ticker, weight: round2(((i.weight > 0 ? i.weight : 0) / totalWeight) * 100) })), basis: "target" };
  }
  return { rows: held.map((i) => ({ ticker: i.ticker, weight: round2(100 / held.length) })), basis: "equal" };
}

export interface LabRequest {
  tickers: string[];
  strategy: NoCodeStrategy | CodeStrategy;
  config: BacktestConfig;
  benchmark: string | undefined;
  start: string;
  end: string;
}

export interface CodeStrategy {
  kind: "code";
  language: StrategyLanguage;
  code: string;
  universe: string[];
  params: Params;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Validate the form and build an engine request, or return the problems in plain words. */
export function toRequest(form: LabForm): { request: LabRequest } | { errors: string[] } {
  const errors: string[] = [];
  const code = form.mode === "code";
  const source = code ? form.universe.map((ticker) => ({ ticker, weight: 0 })) : form.rows;
  const rows = source
    .map((r) => ({ ticker: r.ticker.trim().toUpperCase(), weight: r.weight }))
    .filter((r) => r.ticker);

  for (const r of rows) {
    if (parseTickers([r.ticker], 1).length === 0) errors.push(`"${r.ticker}" is not a valid ticker.`);
  }
  if (new Set(rows.map((r) => r.ticker)).size !== rows.length) errors.push("Each ticker can appear only once.");
  if (rows.length === 0) errors.push("Add at least one ticker.");
  if (rows.length > MAX_UNIVERSE) errors.push(`Use at most ${MAX_UNIVERSE} tickers. Each one is a separate price download.`);

  if (code && !form.code.trim()) errors.push("Write a weights() function, or start from a template.");

  if (!code && form.kind !== "momentum") {
    if (rows.some((r) => !(r.weight >= 0))) errors.push("Weights must be 0% or more.");
    const sum = rows.reduce((s, r) => s + r.weight, 0);
    if (sum > 100.0001) errors.push(`Weights add up to ${sum.toFixed(2)}%. The Lab does not use leverage, so the total must be 100% or less.`);
    if (sum <= 0) errors.push("Give at least one ticker a weight above 0%.");
  }
  if (!code && form.kind === "trend" && !(form.smaDays >= 2)) errors.push("The moving average needs at least 2 days.");
  if (!code && form.kind === "momentum") {
    if (!(form.lookbackDays >= 1)) errors.push("The lookback needs at least 1 day.");
    if (!(form.top >= 1) || form.top > rows.length) errors.push(`Hold between 1 and ${rows.length} assets.`);
  }

  const safe = form.safe.trim().toUpperCase();
  if (safe && parseTickers([safe], 1).length === 0) errors.push(`"${safe}" is not a valid ticker.`);
  const benchmark = form.benchmark.trim().toUpperCase();
  if (benchmark && parseTickers([benchmark], 1).length === 0) errors.push(`"${benchmark}" is not a valid benchmark ticker.`);

  if (!ISO.test(form.start) || !ISO.test(form.end) || form.start >= form.end) errors.push("Choose a start date before the end date.");
  if (!(form.initialCash > 0)) errors.push("Starting amount must be above 0.");
  if (form.rebalance === "drift" && !(form.band > 0 && form.band < 100)) errors.push("The drift band must be between 0 and 100 points.");
  for (const [label, v] of [["Slippage", form.slippageBps], ["Commission", form.commissionBps], ["Minimum commission", form.minCommission]] as const) {
    if (!(v >= 0)) errors.push(`${label} must be 0 or more.`);
  }
  if (!Number.isFinite(form.contribution)) errors.push("The contribution must be a number.");

  if (errors.length) return { errors };

  const allocation = Object.fromEntries(rows.filter((r) => r.weight > 0).map((r) => [r.ticker, r.weight / 100]));
  const strategy: NoCodeStrategy | CodeStrategy = code
    ? { kind: "code", language: form.language, code: form.code, universe: rows.map((r) => r.ticker), params: form.paramOverrides }
    : form.kind === "fixed"
      ? { kind: "fixed", allocation }
      : form.kind === "trend"
        ? { kind: "trend", allocation, smaDays: Math.round(form.smaDays), ...(safe ? { safe } : {}) }
        : {
            kind: "momentum",
            universe: rows.map((r) => r.ticker),
            lookbackDays: Math.round(form.lookbackDays),
            top: Math.round(form.top),
            absolute: form.absolute,
            ...(safe ? { safe } : {}),
          };

  const rebalance: BacktestConfig["rebalance"] =
    form.rebalance === "on-change"
      ? { mode: "on-change" }
      : form.rebalance === "drift"
        ? { mode: "drift", band: form.band / 100 }
        : { mode: "calendar", every: form.rebalance };

  const config: BacktestConfig = {
    initialCash: form.initialCash,
    fill: form.fill,
    costs: { commissionBps: form.commissionBps, minCommission: form.minCommission, slippageBps: form.slippageBps },
    shares: form.shares,
    dividends: form.dividends,
    rebalance,
    ...(form.contribution !== 0 ? { cashFlow: { amount: form.contribution, every: form.contributionEvery } } : {}),
  };

  const own = strategy.kind === "code" ? strategy.universe : strategyTickers(strategy);
  const tickers = [...new Set([...own, ...(benchmark ? [benchmark] : [])])];
  return { request: { tickers, strategy, config, benchmark: benchmark || undefined, start: form.start, end: form.end } };
}
