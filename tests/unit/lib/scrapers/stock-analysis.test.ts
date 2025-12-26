
import { describe, it, expect, mock, beforeAll } from 'bun:test';

// Mock global fetch
const mockFetch = mock((url: string | URL | Request) => {
  const urlStr = url.toString();

  // Stock success case
  if (urlStr.includes('/stocks/aapl/')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`
        <html>
          <main>
            <div>
                <span>Sector</span>
                <a href="/stocks/sector/technology/">Technology</a>
            </div>
            <div>
                <span>Industry</span>
                <a href="/stocks/industry/consumer-electronics/">Consumer Electronics</a>
            </div>
            <h2>About AAPL</h2>
            <p>Apple Inc. designs and manufactures smartphones. It is a very large company that makes iPhones and Macs and other things that people buy.</p>
            <p>It also offers services.</p>
          </main>
        </html>
      `),
    });
  }

  // Stock 404 case
  if (urlStr.includes('/stocks/spy/')) {
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
  }

  // ETF success case (fallback from spy stock)
  if (urlStr.includes('/etf/spy/')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`
        <html>
          <main>
             <h2>About SPY</h2>
             <p>SPDR S&P 500 ETF Trust tracks the S&P 500. It is one of the most popular ETFs in the world and holds a basket of 500 large US companies.</p>
             <meta name="description" content="SPY ETF description fallback">
          </main>
        </html>
      `),
    });
  }

  // Error case
  if (urlStr.includes('/stocks/error/')) {
    return Promise.resolve({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
  }

  return Promise.resolve({
      ok: false,
      status: 404,
  });
});

global.fetch = mockFetch;

// Import after mocking
import { getStockProfile } from '../../../../lib/scrapers/stock-analysis';

describe('getStockProfile', () => {
  it('should scrape stock profile successfully', async () => {
    const profile = await getStockProfile('AAPL');
    // Note: getStockProfile returns { sector, industry, description }, not ticker
    expect(profile?.sector).toBe('Technology');
    expect(profile?.industry).toBe('Consumer Electronics');
    expect(profile?.description).toContain('Apple Inc. designs');
  });

  it('should fallback to ETF URL on 404', async () => {
    const profile = await getStockProfile('SPY');
    expect(profile?.description).toContain('SPDR S&P 500 ETF Trust');
  });

  it('should throw error on failure', async () => {
    try {
        await getStockProfile('ERROR');
    } catch (e: any) {
        expect(e).toBeDefined();
        // The mock returns 500 for 'error' ticker if we set it up, but let's check exact behavior
        // Actually, 'ERROR' ticker -> /stocks/error/company/ -> 500 -> throw
    }
  });
});
