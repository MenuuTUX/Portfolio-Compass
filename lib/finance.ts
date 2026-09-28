import { Decimal } from "./decimal";

export interface DividendHistoryItem {
  date: string;
  amount: number | Decimal; // Allow both
  exDate?: string;
}

export function calculateTTMYield(
  dividendHistory: DividendHistoryItem[],
  currentPrice: number | Decimal,
  options: { historyComplete?: boolean; asOf?: Date } = {},
): Decimal | null {
  if (!Array.isArray(dividendHistory)) return null;
  const price = new Decimal(currentPrice);
  if (!price.isFinite() || !price.greaterThan(0)) {
    return null;
  }
  if (dividendHistory.length === 0) {
    return options.historyComplete ? new Decimal(0) : null;
  }
  if (dividendHistory.some((item) =>
    !Number.isFinite(new Date(item.exDate || item.date).getTime())
  )) return null;

  const now = options.asOf ?? new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const ttmDividends = dividendHistory.filter((item) => {
    // Prefer exDate if available, otherwise use date
    const dateStr = item.exDate || item.date;
    const date = new Date(dateStr);
    return date >= oneYearAgo && date <= now;
  });
  if (ttmDividends.length === 0) {
    return options.historyComplete ? new Decimal(0) : null;
  }
  if (ttmDividends.some((item) => {
    const amount = new Decimal(item.amount);
    return !amount.isFinite() || amount.lessThan(0);
  })) return null;

  const annualPayout = ttmDividends.reduce(
    (sum, item) => sum.plus(new Decimal(item.amount)),
    new Decimal(0),
  );

  return annualPayout.dividedBy(price).times(100); // Return as percentage
}
