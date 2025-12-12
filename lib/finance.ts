import { Decimal } from './decimal';

export interface DividendHistoryItem {
  date: string;
  amount: number | Decimal; // Allow both
  exDate?: string;
}

export function calculateTTMYield(dividendHistory: DividendHistoryItem[], currentPrice: number | Decimal): Decimal {
  if (!dividendHistory || dividendHistory.length === 0) {
    return new Decimal(0);
  }

  const price = new Decimal(currentPrice);
  if (price.isZero()) {
      return new Decimal(0);
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const now = new Date();
  const ttmDividends = dividendHistory.filter(item => {
    // Prefer exDate if available, otherwise use date
    const dateStr = item.exDate || item.date;
    const date = new Date(dateStr);
    return date >= oneYearAgo && date <= now;
  });

  const annualPayout = ttmDividends.reduce((sum, item) => sum.plus(new Decimal(item.amount)), new Decimal(0));

  return annualPayout.dividedBy(price).times(100); // Return as percentage
}
