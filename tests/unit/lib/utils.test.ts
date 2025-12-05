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
    expect(result.label).toBe("Low Risk");
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
    // Annualized Volatility check
    // Daily returns approx +/- 10-20%. Annualized is huge.
    expect(result.stdDev).toBeGreaterThan(0.25); // > 25%
    expect(result.label).toBe("Very High Risk");
  });
});

describe('formatCurrency', () => {
  it('should format CAD currency correctly', () => {
    // The exact output might depend on the locale environment, but we expect it to contain the symbol and number
    const result = formatCurrency(1234.56);
    // Since environment locale might vary slightly in format (e.g. CA$ vs $), we check for key parts
    // But memory says 'en-CA' is used explicitly.
    // 'en-CA' usually formats as "$1,234.56"
    expect(result).toContain('1,234.56');
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
