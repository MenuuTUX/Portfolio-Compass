import type { NoCodeStrategy } from "@/lib/lab/no-code";
import type { StrategyLanguage } from "@/lib/lab/strategy/types";

// Starting code for the Lab editor, and "View as code" for no-code rules.
// Generated code must compute exactly what lib/lab/no-code.ts computes; a test
// runs both and compares.

const py = (v: unknown) => JSON.stringify(v).replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\bnull\b/g, "None");

export function noCodeToSource(s: NoCodeStrategy, language: StrategyLanguage): string {
  return language === "python" ? toPython(s) : toTypeScript(s);
}

function toTypeScript(s: NoCodeStrategy): string {
  const safe = s.kind === "fixed" ? null : (s.safe ?? null);
  if (s.kind === "fixed") {
    return `// Generated from the no-code "Fixed mix" rule.
export const params = {};

const allocation: Record<string, number> = ${JSON.stringify(s.allocation)};

export function weights(prices: Prices, ctx: Context): Weights {
  // The same target every day; the rebalancing schedule decides when to trade.
  return prices.dates.map(() => allocation);
}
`;
  }
  if (s.kind === "trend") {
    return `// Generated from the no-code "Trend filter" rule.
export const params = { smaDays: ${s.smaDays} };

const allocation: Record<string, number> = ${JSON.stringify(s.allocation)};
const safe: string | null = ${JSON.stringify(safe)};

export function weights(prices: Prices, ctx: Context): Weights {
  const n = Number(ctx.params.smaDays);
  const rows = prices.dates.map(() => ({}) as Record<string, number>);
  for (const [ticker, w] of Object.entries(allocation)) {
    const px = prices.col(ticker);
    const avg = ctx.sma(px, n);
    for (let t = 0; t < prices.length; t++) {
      // Before a full window there is no signal, so the asset is held.
      const above = Number.isNaN(avg[t]) || Number.isNaN(px[t]) || px[t] > avg[t];
      const target = above ? ticker : safe;
      if (target) rows[t][target] = (rows[t][target] ?? 0) + w;
    }
  }
  return rows;
}
`;
  }
  return `// Generated from the no-code "Momentum" rule.
export const params = { lookback: ${s.lookbackDays}, top: ${s.top}, absolute: ${s.absolute} };

const universe = ${JSON.stringify(s.universe)};
const safe: string | null = ${JSON.stringify(safe)};

export function weights(prices: Prices, ctx: Context): Weights {
  const n = Number(ctx.params.lookback);
  const top = Number(ctx.params.top);
  const rets = universe.map((ticker) => ctx.returns(prices.col(ticker), n));
  return prices.dates.map((_, t) => {
    const row: Record<string, number> = {};
    const ranked = universe
      .map((ticker, i) => ({ ticker, r: rets[i][t] }))
      .filter((x) => Number.isFinite(x.r))
      .sort((a, b) => b.r - a.r)
      .slice(0, top);
    for (const { ticker, r } of ranked) {
      const target = ctx.params.absolute && r < 0 ? safe : ticker;
      if (target) row[target] = (row[target] ?? 0) + 1 / top;
    }
    return row;
  });
}
`;
}

function toPython(s: NoCodeStrategy): string {
  const safe = s.kind === "fixed" ? null : (s.safe ?? null);
  if (s.kind === "fixed") {
    return `# Generated from the no-code "Fixed mix" rule.
import pandas as pd

PARAMS = {}
ALLOCATION = ${py(s.allocation)}


def weights(prices: pd.DataFrame, ctx) -> pd.DataFrame:
    # The same target every day; the rebalancing schedule decides when to trade.
    w = pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    for ticker, weight in ALLOCATION.items():
        w[ticker] = weight
    return w
`;
  }
  if (s.kind === "trend") {
    return `# Generated from the no-code "Trend filter" rule.
import pandas as pd

PARAMS = {"sma_days": ${s.smaDays}}
ALLOCATION = ${py(s.allocation)}
SAFE = ${py(safe)}


def weights(prices: pd.DataFrame, ctx) -> pd.DataFrame:
    n = int(ctx.params["sma_days"])
    w = pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    for ticker, weight in ALLOCATION.items():
        px = prices[ticker]
        # Average of the last n prices that exist; gaps are skipped, not counted.
        avg = px.dropna().rolling(n).mean().reindex(px.index)
        # Before a full window there is no signal, so the asset is held.
        above = avg.isna() | px.isna() | (px > avg)
        w.loc[above, ticker] += weight
        if SAFE:
            w.loc[~above, SAFE] += weight
    return w
`;
  }
  return `# Generated from the no-code "Momentum" rule.
import pandas as pd

PARAMS = {"lookback": ${s.lookbackDays}, "top": ${s.top}, "absolute": ${py(s.absolute)}}
UNIVERSE = ${py(s.universe)}
SAFE = ${py(safe)}


def weights(prices: pd.DataFrame, ctx) -> pd.DataFrame:
    n, top = int(ctx.params["lookback"]), int(ctx.params["top"])
    ret = prices[UNIVERSE].pct_change(n, fill_method=None)
    picked = ret.rank(axis=1, ascending=False, method="first") <= top
    w = pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    for ticker in UNIVERSE:
        hold = picked[ticker]
        if ctx.params["absolute"]:
            loser = hold & (ret[ticker] < 0)
            hold = hold & ~loser
            if SAFE:
                w.loc[loser, SAFE] += 1 / top
        w.loc[hold, ticker] += 1 / top
    return w
`;
}

export interface CodeTemplate {
  id: string;
  label: string;
  description: string;
  universe: string[];
  python: string;
  typescript: string;
}

export const CODE_TEMPLATES: CodeTemplate[] = [
  {
    id: "momentum",
    label: "Sector momentum, top 3",
    description: "Holds the three sector funds with the best 6-month return. Rebalance monthly.",
    universe: ["XLB", "XLE", "XLF", "XLI", "XLK", "XLP", "XLU", "XLV", "XLY"],
    python: `import pandas as pd
import compass

PARAMS = {"lookback": 126, "top": 3}


def weights(prices: pd.DataFrame, ctx) -> pd.DataFrame:
    """prices: adjusted closes, one column per ticker, NaN before a fund existed.
    Return target weights with the same shape. The engine trades at the next bar."""
    momentum = compass.returns(prices, ctx.params["lookback"])
    return compass.top_n(momentum, ctx.params["top"])
`,
    typescript: `export const params = { lookback: 126, top: 3 };

export function weights(prices: Prices, ctx: Context): Weights {
  // Adjusted closes in, target weights out. The engine trades at the next bar.
  const n = Number(ctx.params.lookback);
  const scores: Record<string, Float64Array> = {};
  for (const ticker of prices.tickers) scores[ticker] = ctx.returns(prices.col(ticker), n);
  return ctx.topN(scores, Number(ctx.params.top));
}
`,
  },
  {
    id: "inverse-vol",
    label: "Inverse volatility",
    description: "Weights each asset by 1 / its 3-month volatility, so calmer assets get more. Rebalance monthly.",
    universe: ["SPY", "EFA", "AGG", "GLD", "VNQ"],
    python: `import pandas as pd
import compass

PARAMS = {"window": 63}


def weights(prices: pd.DataFrame, ctx) -> pd.DataFrame:
    return compass.inverse_vol(prices, ctx.params["window"])
`,
    typescript: `export const params = { window: 63 };

export function weights(prices: Prices, ctx: Context): Weights {
  const n = Number(ctx.params.window);
  const vol = prices.tickers.map((ticker) => ctx.stdev(ctx.returns(prices.col(ticker)), n));
  return prices.dates.map((_, t) => {
    const inv = vol.map((v) => (v[t] > 0 ? 1 / v[t] : 0));
    const total = inv.reduce((a, b) => a + b, 0);
    return inv.map((x) => (total > 0 ? x / total : 0));
  });
}
`,
  },
  {
    id: "crossover",
    label: "Moving-average crossover",
    description: "Holds SPY while its 50-day average is above its 200-day average, otherwise Treasuries. Rebalance when targets change.",
    universe: ["SPY", "IEF"],
    python: `import pandas as pd
import compass

PARAMS = {"fast": 50, "slow": 200, "risky": "SPY", "safe": "IEF"}


def weights(prices: pd.DataFrame, ctx) -> pd.DataFrame:
    p = ctx.params
    px = prices[p["risky"]]
    on = compass.sma(px, p["fast"]) > compass.sma(px, p["slow"])
    w = pd.DataFrame(0.0, index=prices.index, columns=prices.columns)
    w.loc[on, p["risky"]] = 1.0
    w.loc[~on, p["safe"]] = 1.0
    print(f"In {p['risky']} on {on.mean():.0%} of days")
    return w
`,
    typescript: `export const params = { fast: 50, slow: 200, risky: "SPY", safe: "IEF" };

export function weights(prices: Prices, ctx: Context): Weights {
  const p = ctx.params;
  const px = prices.col(String(p.risky));
  const fast = ctx.sma(px, Number(p.fast));
  const slow = ctx.sma(px, Number(p.slow));
  let days = 0;
  const rows = prices.dates.map((_, t) => {
    const on = fast[t] > slow[t];
    if (on) days++;
    return { [String(on ? p.risky : p.safe)]: 1 };
  });
  console.log(\`In \${p.risky} on \${Math.round((100 * days) / prices.length)}% of days\`);
  return rows;
}
`,
  },
];
