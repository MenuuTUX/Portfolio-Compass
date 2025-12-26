
import { describe, it, expect } from 'bun:test';
import { Decimal } from 'decimal.js';

describe('Sector Reduction Logic', () => {
  const safeDecimal = (val: any) => {
      if (Decimal.isDecimal(val)) return val.toNumber();
      if (typeof val === 'string') return parseFloat(val);
      if (typeof val === 'number') return val;
      return 0;
  };

  const mockEtf = {
    sectors: [
      { sector_name: 'Technology', weight: new Decimal(0.45) },
      { sector_name: 'Healthcare', weight: new Decimal(0.15) },
      { sector_name: 'Financials', weight: new Decimal(0.10) },
    ]
  };

  it('transforms sectors correctly using reduce (current)', () => {
    const sectors = (mockEtf.sectors || []).reduce((acc: { [key: string]: number }, sector: any) => {
      acc[sector.sector_name] = safeDecimal(sector.weight);
      return acc;
    }, {} as { [key: string]: number });

    expect(sectors).toEqual({
      'Technology': 0.45,
      'Healthcare': 0.15,
      'Financials': 0.10
    });
  });

  it('transforms sectors correctly using for loop (optimized)', () => {
    const sectors: Record<string, number> = {};
    if (mockEtf.sectors) {
        for (const sector of mockEtf.sectors) {
            sectors[sector.sector_name] = safeDecimal(sector.weight);
        }
    }

    expect(sectors).toEqual({
      'Technology': 0.45,
      'Healthcare': 0.15,
      'Financials': 0.10
    });
  });

  it('handles empty/null sectors', () => {
      const etfEmpty = { sectors: [] };
      const etfNull = { sectors: null };

      const runOptimized = (etf: any) => {
        const sectors: Record<string, number> = {};
        if (etf.sectors) {
            for (const sector of etf.sectors) {
                sectors[sector.sector_name] = safeDecimal(sector.weight);
            }
        }
        return sectors;
      };

      expect(runOptimized(etfEmpty)).toEqual({});
      expect(runOptimized(etfNull)).toEqual({});
  });
});
