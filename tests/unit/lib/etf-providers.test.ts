import { describe, it, expect } from 'bun:test';
import { getAssetIconUrl } from '@/lib/etf-providers';

describe('getAssetIconUrl', () => {
  describe('STOCKS', () => {
    it('should return ticker icon for stocks', () => {
      expect(getAssetIconUrl('AAPL', 'Apple Inc', 'STOCK')).toBe('/api/logo/AAPL');
    });
  });

  describe('ETFs', () => {
    it('falls back to the CDN ticker icon for unknown providers', () => {
      expect(getAssetIconUrl('UNKNOWN', 'Unknown ETF', 'ETF')).toBe('/api/logo/UNKNOWN');
    });

    it('falls back to the CDN when a matched provider has no local art', () => {
      // AGFiQ is in the provider table but ships no logo file.
      expect(getAssetIconUrl('QQD', 'AGFiQ Enhanced Core', 'ETF')).toBeNull();
    });
  });

  describe('Others', () => {
    it('should return null for unknown asset types', () => {
        expect(getAssetIconUrl('FOO', 'Bar', 'UNKNOWN')).toBeNull();
    });
  });
});
