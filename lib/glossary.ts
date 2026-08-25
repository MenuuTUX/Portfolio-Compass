/**
 * Beginner-friendly glossary for technical investing terms.
 * Keys are matched case-insensitively against UI labels.
 */

export interface GlossaryEntry {
  /** Short display name */
  label: string;
  /** What it is, in plain English */
  what: string;
  /** Why a beginner should care / how to read it */
  means: string;
}

const entries = {
  "market cap": {
    label: "Market Cap",
    what: "The total market value of a company: share price multiplied by shares outstanding.",
    means: "Useful for grouping companies by size. Market cap alone does not measure quality or risk.",
  },
  assets: {
    label: "Assets (AUM)",
    what: "For ETFs, how much money investors have put into the fund.",
    means: "Shows the fund's scale. It does not tell you whether the fund is liquid, suitable, or likely to perform well.",
  },
  "pe ratio": {
    label: "P/E Ratio",
    what: "Share price divided by earnings per share.",
    means: "Shows how much investors pay for each dollar of earnings. Compare it with similar companies and check what drives the difference.",
  },
  "forward pe": {
    label: "Forward P/E",
    what: "P/E calculated with estimated future earnings instead of reported past earnings.",
    means: "It depends on forecasts that can change or turn out to be wrong.",
  },
  "eps (ttm)": {
    label: "EPS (TTM)",
    what: "Earnings per share over the trailing twelve months: profit divided by shares.",
    means: "Use it to track per-share profitability. Negative EPS means the company reported a net loss for the period.",
  },
  eps: {
    label: "EPS",
    what: "The company's profit or loss allocated to each common share.",
    means: "Use it to compare per-share profitability over time, while checking for one-time items and share-count changes.",
  },
  "div yield": {
    label: "Dividend Yield",
    what: "Annual dividends per share divided by the current share price.",
    means: "Dividends are not guaranteed. A high yield can result from a falling share price or a payout that may not last.",
  },
  "dividend yield": {
    label: "Dividend Yield",
    what: "Annual dividends per share as a percentage of the current share price.",
    means: "Cash income you may receive if you hold the shares. Yields change as price moves.",
  },
  yield: {
    label: "Yield",
    what: "Annual income as a percentage of the investment's current price.",
    means: "A higher yield means more current income relative to price, but says nothing by itself about payout stability or total return.",
  },
  dividend: {
    label: "Dividend",
    what: "Cash a company or fund pays to shareholders, usually quarterly.",
    means: "Not every company or fund pays one, and a dividend can be reduced or stopped.",
  },
  "dividend (ttm)": {
    label: "Dividend (TTM)",
    what: "Total cash dividends paid per share over the last 12 months.",
    means: "The dollar amount of income one share would have paid you last year.",
  },
  "ex-div date": {
    label: "Ex-Dividend Date",
    what: "The cutoff date to own the stock and still receive the next dividend.",
    means: "Someone who buys on or after this date generally does not receive the next declared dividend. The market price may adjust for the payment.",
  },
  "ex-dividend date": {
    label: "Ex-Dividend Date",
    what: "The cutoff date to own the stock and still receive the next dividend.",
    means: "You must own shares before this date to get paid the next dividend.",
  },
  "earnings date": {
    label: "Earnings Date",
    what: "When the company reports quarterly profits (and often guidance).",
    means: "New results or guidance can cause a sharp price move in either direction.",
  },
  beta: {
    label: "Beta",
    what: "How much the stock moves vs. the overall market.",
    means: "A beta near 1 means similar historical sensitivity to the benchmark. Beta above or below 1 means greater or lower sensitivity, not total risk.",
  },
  volume: {
    label: "Volume",
    what: "How many shares traded today (or recently).",
    means: "Higher volume often supports easier trading, but bid-ask spread and order-book depth also matter.",
  },
  "52w high": {
    label: "52-Week High",
    what: "The highest price over the past year.",
    means: "Shows where today's price sits within its recent range. It does not predict the next move.",
  },
  "52w low": {
    label: "52-Week Low",
    what: "The lowest price over the past year.",
    means: "Shows where today's price sits within its recent range. A low price alone does not establish value.",
  },
  "52 week high": {
    label: "52-Week High",
    what: "The highest price over the past year.",
    means: "Useful context for whether today's price is near a peak or mid-range.",
  },
  "52 week low": {
    label: "52-Week Low",
    what: "The lowest price over the past year.",
    means: "Useful context for how far the price has fallen from its best recent level.",
  },
  revenue: {
    label: "Revenue",
    what: "Total sales before subtracting costs.",
    means: "Revenue growth can show higher sales, but profit also depends on costs, margins, and accounting choices.",
  },
  "net income": {
    label: "Net Income",
    what: "Profit or loss after expenses, interest, and taxes.",
    means: "Compare it across periods and read the underlying statements for one-time gains, charges, and accounting effects.",
  },
  "shares out": {
    label: "Shares Outstanding",
    what: "How many shares exist that investors own.",
    means: "Used with share price to calculate market cap. Issuing more shares can reduce an existing owner's percentage stake.",
  },
  "expense ratio": {
    label: "Expense Ratio (MER)",
    what: "The fund's annual operating expenses as a percentage of assets.",
    means: "Fees reduce returns. Compare funds with similar strategies, since cost is only one difference.",
  },
  mer: {
    label: "MER / Expense Ratio",
    what: "Management Expense Ratio: annual fund expenses as a percentage of assets.",
    means: "MER applies to funds rather than individual stocks. Compare costs among funds that follow similar strategies.",
  },
  holdings: {
    label: "Holdings",
    what: "How many different stocks/bonds the ETF owns.",
    means: "A larger count can reduce exposure to one security, but true diversification also depends on weights, sectors, regions, and how holdings move together.",
  },
  "inception date": {
    label: "Inception Date",
    what: "When the ETF first launched.",
    means: "An older fund has a longer record to inspect, but that record does not predict future performance.",
  },
  "payout frequency": {
    label: "Payout Frequency",
    what: "How often dividends are paid (monthly, quarterly, etc.).",
    means: "Frequency changes the timing of cash payments, not necessarily the total annual amount.",
  },
  "payout ratio": {
    label: "Payout Ratio",
    what: "Share of earnings paid out as dividends.",
    means: "A high ratio may leave less room for a setback, but appropriate levels vary by industry and fund structure.",
  },
  open: {
    label: "Open",
    what: "The first trade price when the market opened today.",
    means: "Compare to previous close to see the overnight gap up or down.",
  },
  "previous close": {
    label: "Previous Close",
    what: "Yesterday's last trade price.",
    means: "Today's % change is usually measured from this level.",
  },
  "day's range": {
    label: "Day's Range",
    what: "Lowest and highest prices traded today.",
    means: "A wide range means a volatile day; a tight range means calm trading.",
  },
  "closing price": {
    label: "Closing Price",
    what: "The last trade price of the regular session (or latest available).",
    means: "The number most charts and daily performance are based on.",
  },
  "change percent": {
    label: "Daily Change %",
    what: "How much the price moved today vs. the previous close.",
    means: "It is a one-day move, not evidence of a longer trend.",
  },
  "fear & greed": {
    label: "Fear & Greed Index",
    what: "A composite score intended to summarize market sentiment from 0 to 100.",
    means: "It is a sentiment indicator, not a valuation measure or a stand-alone trading signal.",
  },
  "value at risk": {
    label: "Value at Risk (VaR)",
    what: "In simulations, roughly how much you could lose in a bad (5th percentile) outcome.",
    means: "A larger modeled loss indicates more downside within the stated assumptions. VaR does not describe losses beyond its chosen percentile.",
  },
  "monte carlo": {
    label: "Monte Carlo",
    what: "A method that generates random paths from specified return, volatility, and correlation assumptions.",
    means: "Shows a distribution of model outcomes. The result is not a forecast and depends on the assumptions.",
  },
  sharpe: {
    label: "Sharpe Ratio",
    what: "Return earned per unit of risk (volatility), after a risk-free rate.",
    means: "A higher historical value means more excess return per unit of measured volatility. The result changes with the period, data, and risk-free rate.",
  },
  volatility: {
    label: "Volatility",
    what: "The measured variability of returns over a stated period.",
    means: "Higher volatility means larger historical swings. It does not capture every type of investment risk.",
  },
  "annual return": {
    label: "Annual Return",
    what: "A yearly rate of gain or loss over a stated period.",
    means: "Past returns don't guarantee future ones. Use as a planning assumption, not a promise.",
  },
  weight: {
    label: "Portfolio Weight",
    what: "What % of your portfolio this holding represents.",
    means: "Weights should add up to ~100%. Larger weight = more impact if that asset moves.",
  },
  diversification: {
    label: "Diversification",
    what: "Spreading money across different assets so one failure hurts less.",
    means: "Diversification can reduce concentration risk, but it cannot prevent losses in a broad market decline.",
  },
  etf: {
    label: "ETF",
    what: "Exchange-traded fund: a pooled investment that trades on an exchange.",
    means: "An ETF may hold many securities, but it is not automatically diversified. Check its holdings, weights, strategy, and fees.",
  },
  stock: {
    label: "Stock",
    what: "A share of ownership in one company.",
    means: "Its value depends heavily on one company, so it carries company-specific risk that a broad fund may spread across many holdings.",
  },
  bond: {
    label: "Bond",
    what: "A loan to a company or government that pays interest.",
    means: "Bonds can add income and diversification, but their prices still respond to interest rates, credit risk, and market conditions.",
  },
} satisfies Record<string, GlossaryEntry>;

const entriesByKey = new Map<string, GlossaryEntry>(Object.entries(entries));

/** Normalize a UI label into a glossary key. */
function normalizeKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[%$]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[/_]/g, " ")
    .replace(/\s*\(.*?\)\s*/g, (m) => m.toLowerCase()) // keep (ttm) etc lowercased
    .replace(/\s+/g, " ")
    .trim();
}

/** Look up a glossary entry by UI label (fuzzy). */
export function getGlossaryEntry(label: string): GlossaryEntry | null {
  if (!label) return null;
  const key = normalizeKey(label);
  const directEntry = entriesByKey.get(key);
  if (directEntry) return directEntry;

  // Aliases and partial matches. Keys are already normalized.
  const aliases: [RegExp, string][] = [
    [/^mkt\.?\s*cap/, "market cap"],
    [/^market\s*capitalization/, "market cap"],
    [/^p\s*\/?\s*e(\s*ratio)?$/, "pe ratio"],
    [/^forward\s*p\s*\/?\s*e/, "forward pe"],
    [/^eps/, "eps (ttm)"],
    [/^div\.?\s*yield/, "div yield"],
    [/^dividend\s*yield/, "dividend yield"],
    [/^expense/, "expense ratio"],
    [/^mer\b/, "mer"],
    [/^ex[-\s]?div/, "ex-div date"],
    [/^52\s*-?\s*w(eek)?\s*high/, "52w high"],
    [/^52\s*-?\s*w(eek)?\s*low/, "52w low"],
    [/^shares?\s*out/, "shares out"],
    [/^aum\b/, "assets"],
    [/^net\s*asset/, "assets"],
    [/^ttm\s*div/, "dividend (ttm)"],
  ];

  for (const [re, target] of aliases) {
    const targetEntry = entriesByKey.get(target);
    if (re.test(key) && targetEntry) return targetEntry;
  }

  // Soft contains match on known keys
  for (const [k, entry] of entriesByKey) {
    if (key.includes(k) || k.includes(key)) return entry;
  }

  return null;
}

export function hasGlossaryEntry(label: string): boolean {
  return getGlossaryEntry(label) !== null;
}
