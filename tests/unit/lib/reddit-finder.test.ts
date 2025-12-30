import { describe, it, expect } from 'bun:test';
import { findRedditCommunity } from '@/lib/reddit-finder';

describe('Reddit Finder', () => {
  it('maps direct matches correctly', async () => {
    expect(await findRedditCommunity('TSM', 'Taiwan Semiconductor')).toBe('https://www.reddit.com/r/TSMC/');
    expect(await findRedditCommunity('NVDA', 'Nvidia')).toBe('https://www.reddit.com/r/Nvidia/');
    expect(await findRedditCommunity('GME', 'GameStop')).toBe('https://www.reddit.com/r/Superstonk/');
  });

  it('maps base tickers correctly', async () => {
    expect(await findRedditCommunity('SHOP.TO', 'Shopify')).toBe('https://www.reddit.com/r/shopify/');
  });

  it('maps Just Buy tickers correctly', async () => {
    expect(await findRedditCommunity('XEQT.TO', 'iShares Core Equity')).toBe('https://www.reddit.com/r/JustBuyXEQT/');
    expect(await findRedditCommunity('VDAL.AX', 'Vanguard Australian Shares')).toBe('https://www.reddit.com/r/fiaustralia/');
  });

  it('returns null for unknown tickers', async () => {
    expect(await findRedditCommunity('XYZ123', 'Unknown Asset')).toBeNull();
  });
});
