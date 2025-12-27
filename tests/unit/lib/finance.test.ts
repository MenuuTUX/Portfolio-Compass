import { describe, it, expect } from 'bun:test';
import { calculateTTMYield, forecastExpectedReturns, type DividendHistoryItem } from '../../../lib/finance';
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

describe('forecastExpectedReturns', () => {
  it('should calculate expected returns correctly using default riskFreeRate', () => {
    const assets = [
      { scores: { composite: 1.0 } },  // Z=1
      { scores: { composite: 0.0 } },  // Z=0
      { scores: { composite: -1.0 } }  // Z=-1
    ];
    const benchmarkVol = 0.15;

    const returns = forecastExpectedReturns(assets, benchmarkVol);

    // Formula: 0.04 + (Z * 0.15)
    // Z=1: 0.04 + 0.15 = 0.19
    // Z=0: 0.04 + 0 = 0.04
    // Z=-1: 0.04 - 0.15 = -0.11

    expect(returns.length).toBe(3);
    expect(returns[0]).toBeCloseTo(0.19);
    expect(returns[1]).toBeCloseTo(0.04);
    expect(returns[2]).toBeCloseTo(-0.11);
  });

  it('should calculate expected returns correctly using custom riskFreeRate', () => {
    const assets = [
      { scores: { composite: 2.0 } }
    ];
    const benchmarkVol = 0.10;
    const riskFreeRate = 0.05;

    const returns = forecastExpectedReturns(assets, benchmarkVol, riskFreeRate);

    // Formula: 0.05 + (2.0 * 0.10) = 0.25
    expect(returns[0]).toBeCloseTo(0.25);
  });

  it('should handle empty input array', () => {
    const returns = forecastExpectedReturns([], 0.15);
    expect(returns).toEqual([]);
  });

  it('should handle zero benchmark volatility', () => {
    const assets = [
      { scores: { composite: 10.0 } }
    ];
    // If benchmark vol is 0, return should be just riskFreeRate
    const returns = forecastExpectedReturns(assets, 0);
    expect(returns[0]).toBeCloseTo(0.04);
  });
});
