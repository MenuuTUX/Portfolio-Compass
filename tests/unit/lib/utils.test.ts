import { describe, it, expect } from 'bun:test';
import { calculateRiskMetric, cn, formatCurrency, formatPercentage } from '../../../lib/utils';

describe('calculateRiskMetric', () => {
  it('should return default safe values for empty history', () => {
    const result = calculateRiskMetric([]);
    expect(result.stdDev).toBe(0);
    expect(result.label).toBe("Unknown");
  });

  it('should return default safe values for single item history', () => {
    const result = calculateRiskMetric([{ date: '2023-01-01', price: 100 }]);
    expect(result.stdDev).toBe(0);
    expect(result.label).toBe("Unknown");
  });

  it('should calculate risk correctly for low volatility', () => {
    // Small changes
    const history = [
      { date: '2023-01-01', price: 100 },
      { date: '2023-01-02', price: 100.1 },
      { date: '2023-01-03', price: 100.2 },
      { date: '2023-01-04', price: 100.1 }
    ];
    const result = calculateRiskMetric(history);
    expect(result.stdDev).toBeGreaterThan(0);
    expect(result.label).toContain("period variability");
  });

  it('should calculate risk correctly for high volatility', () => {
    // Large changes
    const history = [
      { date: '2023-01-01', price: 100 },
      { date: '2023-01-02', price: 110 },
      { date: '2023-01-03', price: 90 },
      { date: '2023-01-04', price: 120 }
    ];
    const result = calculateRiskMetric(history);
    expect(result.stdDev).toBeGreaterThan(0.025); // > 2.5%
    expect(result.label).toContain("period variability");
  });
});

describe('formatCurrency', () => {
  it('should format CAD currency correctly', () => {
    const result = formatCurrency(1234.56, 'CAD');
    // Assert on the digits only: the en-CA currency symbol renders as "$" or
    // "CA$" depending on the ICU build.
    expect(result).toContain('1,234.56');
  });

  it('keeps USD distinct from CAD and marks unknown currency', () => {
    expect(formatCurrency(100, 'USD')).toContain('USD');
    expect(formatCurrency(100)).toContain('currency unavailable');
  });
});

describe('formatPercentage', () => {
  it('should format percentage correctly', () => {
    const result = formatPercentage(5.1234);
    expect(result).toBe('5.12%');
  });

  it('should handle round numbers', () => {
    const result = formatPercentage(5);
    expect(result).toBe('5.00%');
  });
});

describe('cn (classname utility)', () => {
  it('should merge classes correctly', () => {
    const result = cn('text-red-500', 'bg-blue-500');
    expect(result).toBe('text-red-500 bg-blue-500');
  });

  it('should handle conditional classes', () => {
    const result = cn('text-red-500', false && 'bg-blue-500', 'p-4');
    expect(result).toBe('text-red-500 p-4');
  });

  it('should handle tailwind conflicts (using tailwind-merge)', () => {
    const result = cn('p-2', 'p-4');
    expect(result).toBe('p-4');
  });
});
