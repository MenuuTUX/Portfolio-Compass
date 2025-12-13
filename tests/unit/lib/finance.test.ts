import { describe, it, expect } from 'bun:test';
import { calculateTTMYield, type DividendHistoryItem } from '../../../lib/finance';
import { Decimal } from 'decimal.js';

describe('calculateTTMYield', () => {
  it('should return 0 if dividend history is empty', () => {
    const yieldValue = calculateTTMYield([], 100);
    expect(yieldValue.toNumber()).toBe(0);
  });

  it('should return 0 if current price is 0', () => {
    const history: DividendHistoryItem[] = [{ date: '2023-01-01', amount: 1 }];
    const yieldValue = calculateTTMYield(history, 0);
    expect(yieldValue.toNumber()).toBe(0);
  });

  it('should calculate correct TTM yield', () => {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const history: DividendHistoryItem[] = [
      { date: sixMonthsAgo.toISOString(), amount: 2.5 },
      { date: sixMonthsAgo.toISOString(), amount: 2.5 }
    ];

    // Total dividend = 5. Price = 100. Yield = 5%
    const yieldValue = calculateTTMYield(history, 100);
    expect(yieldValue.toNumber()).toBe(5);
  });

  it('should ignore dividends older than one year', () => {
    const now = new Date();
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(now.getFullYear() - 2);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const history: DividendHistoryItem[] = [
      { date: twoYearsAgo.toISOString(), amount: 10 }, // Should be ignored
      { date: sixMonthsAgo.toISOString(), amount: 5 }   // Should be counted
    ];

    // Total dividend = 5. Price = 100. Yield = 5%
    const yieldValue = calculateTTMYield(history, 100);
    expect(yieldValue.toNumber()).toBe(5);
  });

  it('should prefer exDate over date', () => {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(now.getFullYear() - 2);

    const history: DividendHistoryItem[] = [
      {
        date: twoYearsAgo.toISOString(),
        exDate: sixMonthsAgo.toISOString(), // valid
        amount: 5
      },
      {
        date: sixMonthsAgo.toISOString(),
        exDate: twoYearsAgo.toISOString(), // invalid
        amount: 10
      }
    ];

    // Total dividend = 5. Price = 100. Yield = 5%
    const yieldValue = calculateTTMYield(history, 100);
    expect(yieldValue.toNumber()).toBe(5);
  });
});
