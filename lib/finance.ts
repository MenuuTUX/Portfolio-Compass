
export interface DividendHistoryItem {
  date: string;
  amount: number;
  exDate?: string;
}

export function calculateTTMYield(dividendHistory: DividendHistoryItem[], currentPrice: number): number {
  if (!dividendHistory || dividendHistory.length === 0 || currentPrice === 0) {
    return 0;
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

  const annualPayout = ttmDividends.reduce((sum, item) => sum + item.amount, 0);

  return (annualPayout / currentPrice) * 100; // Return as percentage
}
