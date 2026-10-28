// Heatmap groups: membership and sector only. Tiles are sized by live market cap
// at request time, so no weights live here.
export type HeatmapGroupId = "sp500" | "nasdaq100" | "dow30" | "mag7";

export interface HeatmapGroup {
  id: HeatmapGroupId;
  label: string;
  blurb: string;
  /** ETF whose day change stands in for the index; null = cap-weighted average of the members. */
  benchmark: string | null;
  sectors: Record<string, string[]>;
}

const SP500: Record<string, string[]> = {
  "Information Technology": [
    "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "AMD", "ADBE", "CSCO", "ACN", "IBM", "INTU",
    "NOW", "QCOM", "TXN", "AMAT", "PANW", "MU", "ANET", "LRCX", "KLAC", "ADI", "PLTR", "INTC",
  ],
  "Communication Services": ["GOOGL", "META", "NFLX", "DIS", "TMUS", "VZ", "T", "CMCSA"],
  "Consumer Discretionary": ["AMZN", "TSLA", "HD", "MCD", "BKNG", "LOW", "TJX", "NKE", "SBUX"],
  "Consumer Staples": ["WMT", "COST", "PG", "KO", "PEP", "PM", "MDLZ", "CL"],
  Financials: ["BRK-B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "AXP", "C", "SCHW", "BLK"],
  "Health Care": ["LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "ISRG", "AMGN", "PFE", "DHR", "GILD"],
  Industrials: ["GE", "CAT", "RTX", "HON", "UNP", "BA", "DE", "LMT", "UPS", "ETN"],
  Energy: ["XOM", "CVX", "COP", "EOG", "SLB"],
  Utilities: ["NEE", "SO", "DUK"],
  "Real Estate": ["PLD", "AMT", "EQIX"],
  Materials: ["LIN", "SHW", "FCX"],
};

const NASDAQ100: Record<string, string[]> = {
  "Information Technology": [
    "AAPL", "MSFT", "NVDA", "AVGO", "AMD", "ADBE", "CSCO", "QCOM", "INTU", "TXN", "AMAT", "LRCX",
    "PANW", "MU", "ADI", "KLAC", "CDNS", "SNPS", "CRWD", "MRVL", "FTNT", "PLTR", "INTC", "ASML",
  ],
  "Communication Services": ["GOOGL", "META", "NFLX", "TMUS", "CMCSA"],
  "Consumer Discretionary": ["AMZN", "TSLA", "BKNG", "SBUX", "MAR", "ORLY", "ABNB", "MELI"],
  "Consumer Staples": ["COST", "PEP", "MDLZ", "KDP"],
  "Health Care": ["AMGN", "ISRG", "GILD", "VRTX", "REGN"],
  Industrials: ["HON", "ADP", "PCAR", "CTAS", "CSX"],
  Financials: ["PYPL"],
};

const DOW30: Record<string, string[]> = {
  "Information Technology": ["AAPL", "MSFT", "NVDA", "CRM", "CSCO", "IBM"],
  "Communication Services": ["DIS", "VZ"],
  "Consumer Discretionary": ["AMZN", "HD", "MCD", "NKE"],
  "Consumer Staples": ["WMT", "PG", "KO"],
  Financials: ["V", "JPM", "GS", "AXP", "TRV"],
  "Health Care": ["UNH", "JNJ", "MRK", "AMGN"],
  Industrials: ["CAT", "BA", "HON", "MMM"],
  Energy: ["CVX"],
  Materials: ["SHW"],
};

const MAG7: Record<string, string[]> = {
  "Magnificent 7": ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA"],
};

export const HEATMAP_GROUPS: HeatmapGroup[] = [
  { id: "sp500", label: "S&P 500", blurb: "100 largest members by sector", benchmark: "SPY", sectors: SP500 },
  { id: "nasdaq100", label: "Nasdaq-100", blurb: "Largest Nasdaq-100 members", benchmark: "QQQ", sectors: NASDAQ100 },
  { id: "dow30", label: "Dow Jones 30", blurb: "The 30 Dow components", benchmark: "DIA", sectors: DOW30 },
  { id: "mag7", label: "Magnificent 7", blurb: "The seven mega-cap leaders", benchmark: null, sectors: MAG7 },
];

export const DEFAULT_HEATMAP_GROUP: HeatmapGroupId = "sp500";

export function getHeatmapGroup(id: string | null): HeatmapGroup | undefined {
  return HEATMAP_GROUPS.find((g) => g.id === id);
}
