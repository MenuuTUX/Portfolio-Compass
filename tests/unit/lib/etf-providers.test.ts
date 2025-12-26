import { describe, it, expect } from 'bun:test';
import { getAssetIconUrl } from '@/lib/etf-providers';

describe('getAssetIconUrl', () => {
  describe('STOCKS', () => {
    it('should return ticker icon for stocks', () => {
      expect(getAssetIconUrl('AAPL', 'Apple Inc', 'STOCK')).toBe('https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/AAPL.png');
    });
  });

  describe('ETFs', () => {
    it('should resolve provider icon for known providers', () => {
      // SPDR now falls back to stock ticker 'STT' because it has one in the map
      expect(getAssetIconUrl('SPY', 'SPDR S&P 500 ETF Trust', 'ETF')).toContain('/ticker_icons/STT.png');
      expect(getAssetIconUrl('QQQ', 'Invesco QQQ Trust', 'ETF')).toContain('/ticker_icons/IVZ.png');
    });

    it('should fallback to ticker icon for unknown providers', () => {
      expect(getAssetIconUrl('UNKNOWN', 'Unknown ETF', 'ETF')).toBe('https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/UNKNOWN.png');
    });

    it('should handle providers with stock tickers', () => {
       expect(getAssetIconUrl('BLK', 'iShares Core', 'ETF')).toContain('/ticker_icons/BLK.png');
    });
  });

  describe('Others', () => {
    it('should return null for unknown asset types', () => {
        expect(getAssetIconUrl('FOO', 'Bar', 'UNKNOWN')).toBeNull();
    });
  });
});
