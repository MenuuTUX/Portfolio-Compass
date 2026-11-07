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

  it('restores the index and currency symbols the app lets a user add', () => {
    expect(parsePortfolioBackup([
      { ticker: '^gspc', weight: 50, shares: 0 },
      { ticker: 'CAD=X', weight: 50, shares: 0 },
    ]).map((h) => h.ticker)).toEqual(['^GSPC', 'CAD=X']);
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
      [{ ticker: 'SPY', weight: 50, shares: 4 }],
    )).toEqual([
      { ticker: 'SPY', weight: 50, shares: 4 },
      { ticker: 'VTI', weight: 30, shares: 1 },
    ]);
  });
});

describe('loadPortfolio recovery', () => {
  const KEY = 'portfolio_compass_v1';

  it('keeps valid holdings when one stored item is invalid, and preserves the raw data', async () => {
    const { loadPortfolio, CORRUPT_BACKUP_KEY } = await import('@/lib/storage');
    localStorage.clear();
    const raw = JSON.stringify([
      { ticker: 'VOO', weight: 60, shares: 3 },
      { ticker: 'XEQT', weight: 40 },
      { ticker: 'BND', weight: Number.NaN, shares: -2 },
      { weight: 10, shares: 1 },
    ]);
    localStorage.setItem(KEY, raw);

    expect(loadPortfolio()).toEqual([
      { ticker: 'VOO', weight: 60, shares: 3 },
      { ticker: 'XEQT', weight: 40, shares: 0 },
      { ticker: 'BND', weight: 0, shares: 0 },
    ]);
    expect(localStorage.getItem(CORRUPT_BACKUP_KEY)).toBe(raw);
  });

  it('keeps the first corrupt copy when a later load is also invalid', async () => {
    const { loadPortfolio, CORRUPT_BACKUP_KEY } = await import('@/lib/storage');
    localStorage.clear();
    localStorage.setItem(KEY, '{not json');
    expect(loadPortfolio()).toEqual([]);
    localStorage.setItem(KEY, '[{"ticker":"SPY"}]');
    expect(loadPortfolio()).toEqual([{ ticker: 'SPY', weight: 0, shares: 0 }]);
    expect(localStorage.getItem(CORRUPT_BACKUP_KEY)).toBe('{not json');
  });
});

describe('portfolio storage envelope and limits (API-B21, API-B23)', () => {
  const KEY = 'portfolio_compass_v1';

  it('refuses a backup with more than 500 holdings before checking each one', async () => {
    const { MAX_BACKUP_HOLDINGS } = await import('@/lib/storage');
    const many = Array.from({ length: MAX_BACKUP_HOLDINGS + 1 }, (_, i) => ({
      ticker: `T${i}`, weight: 1, shares: 1,
    }));
    expect(() => parsePortfolioBackup(many)).toThrow(/at most 500 holdings/);
    expect(parsePortfolioBackup(many.slice(0, MAX_BACKUP_HOLDINGS))).toHaveLength(MAX_BACKUP_HOLDINGS);
  });

  it('writes a versioned envelope', async () => {
    const { savePortfolio } = await import('@/lib/storage');
    localStorage.clear();
    savePortfolio([{ ticker: 'VOO', weight: 60, shares: 3 }]);
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({
      v: 2,
      items: [{ ticker: 'VOO', weight: 60, shares: 3 }],
    });
  });

  it('reads the old bare array, then writes the envelope on the next save', async () => {
    const { loadPortfolio, savePortfolio } = await import('@/lib/storage');
    localStorage.clear();
    localStorage.setItem(KEY, JSON.stringify([{ ticker: 'BND', weight: 40, shares: 2 }]));
    const loaded = loadPortfolio();
    expect(loaded).toEqual([{ ticker: 'BND', weight: 40, shares: 2 }]);

    savePortfolio(loaded);
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null').v).toBe(2);
    expect(loadPortfolio()).toEqual([{ ticker: 'BND', weight: 40, shares: 2 }]);
  });

  it('reads an envelope written by this version, and repairs bad items inside it', async () => {
    const { loadPortfolio, loadPortfolioBackup } = await import('@/lib/storage');
    localStorage.clear();
    localStorage.setItem(KEY, JSON.stringify({
      v: 2,
      items: [{ ticker: 'VOO', weight: 60, shares: 3 }, { ticker: 'XEQT', weight: -1 }],
    }));
    expect(loadPortfolio()).toEqual([
      { ticker: 'VOO', weight: 60, shares: 3 },
      { ticker: 'XEQT', weight: 0, shares: 0 },
    ]);
    localStorage.setItem(KEY, JSON.stringify({ v: 2, items: [{ ticker: 'VOO', weight: 60, shares: 3 }] }));
    expect(loadPortfolioBackup()).toEqual([{ ticker: 'VOO', weight: 60, shares: 3 }]);
  });

  it('turns a blocked or full storage write into a plain message', async () => {
    const { savePortfolio } = await import('@/lib/storage');
    const blocked = {
      getItem: () => null,
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
      setItem: () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      },
    };
    const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { value: blocked, configurable: true });
    try {
      expect(() => savePortfolio([{ ticker: 'VOO', weight: 60, shares: 3 }])).toThrow(
        'Your browser blocked saving your portfolio (storage is full or disabled)',
      );
    } finally {
      if (real) Object.defineProperty(globalThis, 'localStorage', real);
    }
  });
});
