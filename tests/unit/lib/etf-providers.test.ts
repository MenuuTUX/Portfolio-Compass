
import { describe, it, expect } from 'bun:test';
import { getProviderLogo } from '@/lib/etf-providers';

describe('getProviderLogo', () => {
  it('should return logo path for known provider keywords', () => {
    expect(getProviderLogo('Vanguard S&P 500 ETF')).toBe('/logos/vanguard.png');
    expect(getProviderLogo('iShares Core S&P 500 ETF')).toBe('/logos/ishares.png');
    expect(getProviderLogo('BMO Aggregate Bond Index ETF')).toBe('/logos/bmo-asset-management.png');
  });

  it('should return null for unknown provider', () => {
    expect(getProviderLogo('Random ETF Name')).toBeNull();
  });

  it('should return null for known provider without logo', () => {
    expect(getProviderLogo('AGFiQ US Market Neutral Anti-Beta CAD-Hedged ETF')).toBeNull();
  });

  it('should be case insensitive', () => {
    expect(getProviderLogo('vanguard s&p 500 etf')).toBe('/logos/vanguard.png');
  });
});
