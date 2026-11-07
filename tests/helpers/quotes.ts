/** A live stock quote in the shape lib/fast-market returns; override any field. */
export function fastQuote(ticker: string, overrides: Record<string, unknown> = {}) {
  return {
    ticker,
    name: `${ticker} Name`,
    price: 100,
    changePercent: 1,
    change: 1,
    assetType: "STOCK" as const,
    dividendYield: 0.5,
    expenseRatio: 0,
    ...overrides,
  };
}
