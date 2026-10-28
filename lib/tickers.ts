// Yahoo-style symbols: letters, digits and . - ^ = (BRK.B, BTC-USD, ^GSPC, CAD=X).
const TICKER_PATTERN = /^[A-Z0-9.^=-]{1,15}$/i;

export function parseTickers(raw: readonly string[], max: number): string[] {
  const out: string[] = [];
  for (const item of raw) {
    const ticker = item.trim();
    if (TICKER_PATTERN.test(ticker)) out.push(ticker);
    if (out.length >= max) break;
  }
  return out;
}
