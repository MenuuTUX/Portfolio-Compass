// Yahoo-style symbols: letters, digits and . - ^ = (BRK.B, BTC-USD, ^GSPC, CAD=X).
const TICKER_PATTERN = /^[A-Z0-9.^=-]{1,15}$/i;

/**
 * Yahoo spells share classes with a dash (BRK-B, BF-B). Only A/B/C suffixes are
 * rewritten: single-letter exchange suffixes such as .V (TSX Venture) or .L
 * (London) are real exchange codes and must stay as typed.
 */
export function toYahooSymbol(ticker: string): string {
  const t = ticker.trim().toUpperCase();
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
