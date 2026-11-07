// Yahoo-style symbols: letters, digits and . - ^ = (BRK.B, BTC-USD, ^GSPC, CAD=X).
// The first character must be a letter, digit or ^, so ".." and "-X" never pass.
// Every route, the backup importer and the quote layer share this one rule;
// the scrapers keep their own, stricter rule because they build URLs from it.
const TICKER_PATTERN = /^[A-Z0-9^][A-Z0-9.^=-]{0,14}$/i;

/** The one spelling of a ticker used for storage keys, cache keys and comparisons. */
export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/** The result whose ticker is `ticker`, comparing in the normalized spelling. */
export function matchTicker<T extends { ticker: string }>(results: readonly T[], ticker: string): T | undefined {
  const target = normalizeTicker(ticker);
  return results.find((r) => normalizeTicker(r.ticker) === target);
}

export function isTicker(value: string): boolean {
  return TICKER_PATTERN.test(value);
}

/**
 * Yahoo spells share classes with a dash (BRK-B, BF-B). Only A/B/C suffixes are
 * rewritten: single-letter exchange suffixes such as .V (TSX Venture) or .L
 * (London) are real exchange codes and must stay as typed.
 */
export function toYahooSymbol(ticker: string): string {
  const t = normalizeTicker(ticker);
  return /^[A-Z]{1,5}\.[ABC]$/.test(t) ? t.replace(".", "-") : t;
}

export function parseTickers(raw: readonly string[], max: number): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const ticker = item.trim();
    if (TICKER_PATTERN.test(ticker)) out.push(ticker);
    if (out.length >= max) break;
  }
  return out;
}
