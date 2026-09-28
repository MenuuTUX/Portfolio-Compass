import { Decimal } from "./decimal";

export interface DividendHistoryItem {
  date: string;
  amount: number | Decimal; // Allow both
  exDate?: string;
}

export function calculateTTMYield(
  dividendHistory: DividendHistoryItem[],
  currentPrice: number | Decimal,
): Decimal | null {
  if (!dividendHistory || dividendHistory.length === 0) {
    return null;
  }

  const price = new Decimal(currentPrice);
  if (!price.isFinite() || !price.greaterThan(0)) {
    return null;
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const now = new Date();
  const ttmDividends = dividendHistory.filter((item) => {
    // Prefer exDate if available, otherwise use date
    const dateStr = item.exDate || item.date;
    const date = new Date(dateStr);
    return date >= oneYearAgo && date <= now;
  });
  if (ttmDividends.length === 0) return null;
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
