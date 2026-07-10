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

const entries: Record<string, GlossaryEntry> = {
  "market cap": {
    label: "Market Cap",
    what: "The total value of a company — share price × number of shares.",
    means: "Larger = more established. Mega-caps (>$200B) tend to be steadier; small-caps can swing more.",
  },
  assets: {
    label: "Assets (AUM)",
    what: "For ETFs, how much money investors have put into the fund.",
    means: "Higher assets usually means more liquidity and lower risk of the fund closing.",
  },
  "pe ratio": {
    label: "P/E Ratio",
    what: "Price-to-Earnings: how many years of current profits you're paying for the stock.",
    means: "Lower can mean cheaper (or troubled). Higher can mean growth expectations. Compare within the same industry.",
  },
  "forward pe": {
    label: "Forward P/E",
    what: "P/E using next year's expected earnings instead of past earnings.",
    means: "Useful when a company is growing fast — shows valuation on future profits, not last year.",
  },
  "eps (ttm)": {
    label: "EPS (TTM)",
    what: "Earnings Per Share over the Trailing Twelve Months — profit divided by shares.",
    means: "Rising EPS often supports a higher stock price. Negative EPS means the company lost money.",
  },
  eps: {
    label: "EPS",
    what: "Earnings Per Share — the company's profit for each share of stock.",
    means: "A basic measure of profitability. Growing EPS is usually a good sign.",
  },
  "div yield": {
    label: "Dividend Yield",
    what: "Annual dividends as a % of the current share price.",
    means: "Like interest on a savings account, but not guaranteed. 2–4% is common; very high yields can be a warning sign.",
  },
  "dividend yield": {
    label: "Dividend Yield",
    what: "Annual dividends as a % of the current share price.",
    means: "Cash income you may receive if you hold the shares. Yields change as price moves.",
  },
  yield: {
    label: "Yield",
    what: "Income (dividends) returned each year as a percent of price.",
    means: "Higher yield = more cash income relative to price. Check that the payout looks sustainable.",
  },
  dividend: {
    label: "Dividend",
    what: "Cash a company or fund pays to shareholders, usually quarterly.",
    means: "Optional income — not all stocks pay dividends. Growth companies often reinvest instead.",
  },
  "dividend (ttm)": {
    label: "Dividend (TTM)",
    what: "Total cash dividends paid per share over the last 12 months.",
    means: "The dollar amount of income one share would have paid you last year.",
  },
  "ex-div date": {
    label: "Ex-Dividend Date",
    what: "The cutoff date to own the stock and still receive the next dividend.",
    means: "Buy before this date to get the upcoming payment. On this day the price often drops by about the dividend amount.",
  },
  "ex-dividend date": {
    label: "Ex-Dividend Date",
    what: "The cutoff date to own the stock and still receive the next dividend.",
    means: "You must own shares before this date to get paid the next dividend.",
  },
  "earnings date": {
    label: "Earnings Date",
    what: "When the company reports quarterly profits (and often guidance).",
    means: "Prices can jump or drop a lot around this day — higher risk and opportunity.",
  },
  beta: {
    label: "Beta",
    what: "How much the stock moves vs. the overall market.",
    means: "≈1 moves with the market. >1 is more volatile. <1 is usually calmer. Negative moves opposite the market.",
  },
  volume: {
    label: "Volume",
    what: "How many shares traded today (or recently).",
    means: "Higher volume = easier to buy/sell without moving the price. Very low volume can mean wide spreads.",
  },
  "52w high": {
    label: "52-Week High",
    what: "The highest price over the past year.",
    means: "Near the high can mean strength — or that the easy gains already happened.",
  },
  "52w low": {
    label: "52-Week Low",
    what: "The lowest price over the past year.",
    means: "Near the low can be a bargain or a value trap if the business is deteriorating.",
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
    what: "Total sales — money the company brought in before costs.",
    means: "Growing revenue shows demand. Profit still depends on expenses.",
  },
  "net income": {
    label: "Net Income",
    what: "Profit left after all expenses and taxes (\"the bottom line\").",
    means: "Positive and growing is healthy. Losses may be OK temporarily for high-growth firms.",
  },
  "shares out": {
    label: "Shares Outstanding",
    what: "How many shares exist that investors own.",
    means: "Used with price to get market cap. More shares can dilute each owner's slice.",
  },
  "expense ratio": {
    label: "Expense Ratio (MER)",
    what: "The yearly fee the ETF charges as a % of your investment.",
    means: "Lower is better. 0.03–0.20% is cheap; above ~0.75% is pricey for plain index funds.",
  },
  mer: {
    label: "MER / Expense Ratio",
    what: "Management Expense Ratio — the yearly fee charged by an ETF or mutual fund.",
    means: "Only applies to funds, not individual stocks. Stocks have no MER (you already own the company directly). Lower is better — 0.03–0.20% is cheap.",
  },
  holdings: {
    label: "Holdings",
    what: "How many different stocks/bonds the ETF owns.",
    means: "More holdings usually means more diversification — less risk from any one company.",
  },
  "inception date": {
    label: "Inception Date",
    what: "When the ETF first launched.",
    means: "Older funds have longer track records; brand-new funds have less history to judge.",
  },
  "payout frequency": {
    label: "Payout Frequency",
    what: "How often dividends are paid (monthly, quarterly, etc.).",
    means: "Monthly payers are popular for income; frequency doesn't change total yearly income much.",
  },
  "payout ratio": {
    label: "Payout Ratio",
    what: "Share of earnings paid out as dividends.",
    means: "Under ~60% is often sustainable. Near 100% may leave little room if profits fall.",
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
    means: "Green = up, red = down. Big single-day moves are normal for individual stocks.",
  },
  "fear & greed": {
    label: "Fear & Greed Index",
    what: "A 0–100 score of overall market mood (fearful → greedy).",
    means: "Extreme fear can mean bargains; extreme greed can mean overheating. Not a buy/sell signal alone.",
  },
  "value at risk": {
    label: "Value at Risk (VaR)",
    what: "In simulations, roughly how much you could lose in a bad (5th percentile) outcome.",
    means: "Higher VaR = more downside risk in the model. It's an estimate, not a guarantee.",
  },
  "monte carlo": {
    label: "Monte Carlo",
    what: "A simulation that runs many random market futures based on history.",
    means: "Shows a range of outcomes (best / median / worst) instead of one fixed projection.",
  },
  sharpe: {
    label: "Sharpe Ratio",
    what: "Return earned per unit of risk (volatility), after a risk-free rate.",
    means: "Higher is better. Roughly >1 is solid; <0 means you weren't paid for the risk taken.",
  },
  volatility: {
    label: "Volatility",
    what: "How bumpy returns are — size of typical price swings.",
    means: "Higher volatility = bigger ups and downs. Not the same as \"will lose money,\" but riskier to stomach.",
  },
  "annual return": {
    label: "Annual Return",
    what: "Average yearly growth rate of the investment.",
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
    means: "A core idea of Portfolio Compass — mix assets that don't all move together.",
  },
  etf: {
    label: "ETF",
    what: "Exchange-Traded Fund — a basket of stocks/bonds you can buy like a single stock.",
    means: "Easy diversification in one ticker. Check fees (MER) and what it holds.",
  },
  stock: {
    label: "Stock",
    what: "A share of ownership in one company.",
    means: "Higher potential return than broad funds, but more company-specific risk.",
  },
  bond: {
    label: "Bond",
    what: "A loan to a company or government that pays interest.",
    means: "Usually steadier than stocks; can cushion a portfolio when equities fall.",
  },
};

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
  if (entries[key]) return entries[key];

  // Aliases / partial matches (keys are already normalized: / → space)
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
    if (re.test(key) && entries[target]) return entries[target];
  }

  // Soft contains match on known keys
  for (const [k, entry] of Object.entries(entries)) {
    if (key.includes(k) || k.includes(key)) return entry;
  }

  return null;
}

export function hasGlossaryEntry(label: string): boolean {
  return getGlossaryEntry(label) !== null;
}
