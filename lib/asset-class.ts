/**
 * Asset-class helpers shared by enrichment + UI.
 *
 * Yahoo (and most scrapers) model equity ETFs well and bond/leveraged/commodity
 * funds poorly. Detecting the class lets us show the right breakdown
 * (credit ratings vs sectors, maturity vs PE) instead of empty placeholders.
 */

export type FundClass =
  | "equity"
  | "bond"
  | "mixed"
  | "commodity"
  | "leveraged"
  | "cash"
  | "unknown";

export interface AllocationWeights {
  equities: number; // 0-100
  bonds: number;
  cash: number;
  other?: number;
}

const CREDIT_LABELS = new Map([
  ["us_government", "US Government"],
  ["aaa", "AAA"],
  ["aa", "AA"],
  ["a", "A"],
  ["bbb", "BBB"],
  ["bb", "BB"],
  ["b", "B"],
  ["below_b", "Below B"],
  ["other", "Other"],
]);

interface BondRatingMap {
  [rating: string]: number;
}

/** Human label for a Yahoo bond-rating key. */
export function formatCreditRating(key: string): string {
  const k = key.toLowerCase().replace(/\s+/g, "_");
  return CREDIT_LABELS.get(k) || key.replace(/_/g, " ").toUpperCase();
}

/**
 * Infer fund class from positions and metadata without a network request.
 */
export function detectFundClass(input: {
  name?: string;
  category?: string | null;
  description?: string;
  stockPosition?: number;
  bondPosition?: number;
  cashPosition?: number;
  otherPosition?: number;
}): FundClass {
  const text = [
    input.name,
    input.category,
    input.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Explicit product cues first (leveraged/commodity names are reliable)
  if (
    /\b(2x|3x|leveraged|inverse|bull|bear|daily target)\b/.test(text) ||
    /\blev\b/.test(text)
  ) {
    return "leveraged";
  }
  if (
    /\b(oil|gas|gold|silver|copper|commodity|natural gas|crude|bitcoin|crypto)\b/.test(
      text,
    )
  ) {
    return "commodity";
  }

  const stock = input.stockPosition ?? 0;
  const bond = input.bondPosition ?? 0;
  const cash = input.cashPosition ?? 0;

  // Position-based (fractions 0-1 from Yahoo)
  if (bond >= 0.5 && stock < 0.2) return "bond";
  if (stock >= 0.5 && bond < 0.2) return "equity";
  if (stock >= 0.15 && bond >= 0.15) return "mixed";
  if (cash >= 0.8 && stock < 0.05 && bond < 0.05) {
    // Cash-only book often means futures/swap exposure (leveraged commodity etc.)
    if (/\b(etf|fund)\b/.test(text)) return "leveraged";
    return "cash";
  }

  if (/\bbond|fixed.?income|treasury|aggregate|credit\b/.test(text)) {
    return "bond";
  }
  if (/\bequity|stock|s&p|nasdaq|msci|all.?world\b/.test(text)) {
    return "equity";
  }

  return "unknown";
}

/** Convert Yahoo position fractions into 0-100 allocation weights. */
export function positionsToAllocation(input: {
  stockPosition?: number;
  bondPosition?: number;
  cashPosition?: number;
  otherPosition?: number;
}): AllocationWeights | null {
  const equities = (input.stockPosition ?? 0) * 100;
  const bonds = (input.bondPosition ?? 0) * 100;
  const cash = (input.cashPosition ?? 0) * 100;
  const other = (input.otherPosition ?? 0) * 100;
  const total = equities + bonds + cash + other;
  if (total < 1) return null;
  return { equities, bonds, cash, other };
}

/**
 * Yahoo bondRatings is an array of single-key objects:
 * [{ aaa: 0.72 }, { aa: 0.04 }, ...]. Convert to a name→weight map (0-1).
 */
export function parseBondRatings(
  ratings: Array<Record<string, number>> | undefined | null,
): BondRatingMap {
  const out: BondRatingMap = {};
  if (!Array.isArray(ratings)) return out;
  for (const row of ratings) {
    for (const [key, val] of Object.entries(row)) {
      if (val > 0.0005) {
        out[formatCreditRating(key)] = val;
      }
    }
  }
  return out;
}

/**
 * Normalize expense/MER into percent units for the UI (0.03 = 0.03%).
 *
 * Yahoo is inconsistent by field:
 * - quote.netExpenseRatio → already percent (BND=0.03, SPY=0.0945)
 * - fundProfile.annualReportExpenseRatio → decimal fraction (BND=0.0003)
 * - scrapers → usually already percent with a % sign stripped
 *
 * Zero is treated as missing (Yahoo often returns 0 for .TO funds).
 */
export function normalizeExpenseRatio(
  raw: number | undefined | null,
  source: "quote" | "profile" | "scraper" | "auto" = "auto",
): number | undefined {
  if (raw === undefined || raw === null || !Number.isFinite(raw) || raw <= 0) {
    return undefined;
  }

  if (source === "quote" || source === "scraper") {
    return raw < 20 ? raw : undefined;
  }

  if (source === "profile") {
    // Decimal fraction → percent
    if (raw > 0 && raw < 1) return raw * 100;
    if (raw >= 1 && raw < 20) return raw; // already percent, rare
    return undefined;
  }

  // auto: tiny values are almost always decimals; larger are percent
  if (raw > 0 && raw < 0.01) return raw * 100;
  if (raw >= 0.01 && raw < 20) return raw;
  return undefined;
}

/** Prefer 5y beta, then 3y, ignore zeros. */
export function pickBeta(
  beta?: number | null,
  beta3Year?: number | null,
): number | undefined {
  if (beta != null && Number.isFinite(beta) && beta !== 0) {
    return beta;
  }
  if (
    beta3Year != null &&
    Number.isFinite(beta3Year) &&
    beta3Year !== 0
  ) {
    return beta3Year;
  }
  return undefined;
}

/**
 * Annualized volatility from a price series (daily/weekly points).
 * Returns fraction (0.15 = 15%). Needs ≥10 points.
 */
export function realizedAnnualVolatility(
  history: { price: number }[],
  periodsPerYear = 252,
): number | undefined {
  if (!history || history.length < 10) return undefined;
  const rets: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1].price;
    const b = history[i].price;
    if (a > 0 && b > 0) rets.push(Math.log(b / a));
  }
  if (rets.length < 9) return undefined;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  let varSum = 0;
  for (const r of rets) varSum += (r - mean) ** 2;
  const std = Math.sqrt(varSum / (rets.length - 1));
  const ann = std * Math.sqrt(periodsPerYear);
  if (!Number.isFinite(ann) || ann <= 0) return undefined;
  return ann;
}

/**
 * Map a Yahoo exchange suffix to a stockanalysis.com quote path segment.
 * Only returns paths for known exchanges.
 */
export function stockAnalysisPathForTicker(
  ticker: string,
): { kind: "etf" | "quote"; path: string } | null {
  const t = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,12}$/.test(t)) return null;

  // Canadian listings
  if (t.endsWith(".TO")) {
    return { kind: "quote", path: `quote/tsx/${t.slice(0, -3).toLowerCase()}` };
  }
  if (t.endsWith(".V")) {
    return { kind: "quote", path: `quote/tsxv/${t.slice(0, -2).toLowerCase()}` };
  }
  if (t.endsWith(".NE") || t.endsWith(".CN")) {
    return { kind: "quote", path: `quote/cse/${t.split(".")[0].toLowerCase()}` };
  }

  // US plain symbols (ETF page preferred for funds; caller may try stocks too)
  if (!t.includes(".")) {
    return { kind: "etf", path: `etf/${t.toLowerCase()}` };
  }

  // Other international Yahoo suffixes, such as .MU, .L, .HK, and .TW,
  // stockanalysis coverage is spotty; return null so we don't 404-spam.
  return null;
}
