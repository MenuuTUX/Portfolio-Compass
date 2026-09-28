import { describe, it, expect } from 'bun:test';
import {
  LocalPortfolioSchema,
  mergePortfolioBackup,
  parsePortfolioBackup,
} from '@/lib/storage';

describe('LocalPortfolioSchema', () => {
  it('accepts a well-formed holding', () => {
    const result = LocalPortfolioSchema.safeParse([
      { ticker: 'VOO', weight: 60, shares: 4.5 },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects NaN shares from a cleared number input', () => {
    const result = LocalPortfolioSchema.safeParse([
      { ticker: 'VOO', weight: 60, shares: NaN },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects negative shares and weights', () => {
    expect(
      LocalPortfolioSchema.safeParse([{ ticker: 'VOO', weight: 60, shares: -1 }])
        .success,
    ).toBe(false);
    expect(
      LocalPortfolioSchema.safeParse([{ ticker: 'VOO', weight: -5, shares: 1 }])
        .success,
    ).toBe(false);
  });

  it('rejects an empty ticker', () => {
    expect(
      LocalPortfolioSchema.safeParse([{ ticker: '', weight: 1, shares: 1 }])
        .success,
    ).toBe(false);
  });
});

describe('portfolio backup data', () => {
  it('normalizes tickers and keeps only local holding fields', () => {
    expect(parsePortfolioBackup([
      { ticker: ' voo ', weight: 60, shares: 4.5, price: 500, currency: 'USD' },
    ])).toEqual([{ ticker: 'VOO', weight: 60, shares: 4.5 }]);
  });

  it('rejects malformed holdings and unsupported ticker shapes', () => {
    expect(() => parsePortfolioBackup({ holdings: [] })).toThrow(/array of holdings/);
    expect(() => parsePortfolioBackup([{ ticker: 'BAD/TICKER', weight: 50, shares: 1 }]))
      .toThrow(/not a valid ticker/);
    expect(() => parsePortfolioBackup([{ ticker: 'VOO', weight: -1, shares: 1 }]))
      .toThrow(/array of holdings/);
  });

  it('rejects duplicate tickers after case and whitespace normalization', () => {
    expect(() => parsePortfolioBackup([
      { ticker: ' voo ', weight: 60, shares: 1 },
      { ticker: 'VOO', weight: 40, shares: 2 },
    ])).toThrow(/VOO more than once/);
  });

  it('merge keeps other holdings and replaces a matching ticker', () => {
    expect(mergePortfolioBackup(
      [
        { ticker: 'SPY', weight: 70, shares: 2 },
        { ticker: 'VTI', weight: 30, shares: 1 },
      ],
      [{ ticker: 'spy', weight: 50, shares: 4 }],
    )).toEqual([
      { ticker: 'SPY', weight: 50, shares: 4 },
      { ticker: 'VTI', weight: 30, shares: 1 },
    ]);
  });
});
