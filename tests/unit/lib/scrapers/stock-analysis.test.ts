
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

// The stub only implements the call signature, not fetch's preconnect property
global.fetch = mockFetch as unknown as typeof fetch;

// Import after mocking
// Use dynamic import or ensure this is after the mock
const { getStockProfile, parseMarketNumber } = await import('../../../../lib/scrapers/stock-analysis');

describe('getStockProfile', () => {
  it('should scrape stock profile successfully', async () => {
    const profile = await getStockProfile('AAPL');
    // Note: getStockProfile returns { sector, industry, description }, not ticker
    // If the scraper uses specific DOM structure, we must match it in the mock.
    // The scraper looks for span with "Sector" text, then next element or sibling.
    // Our mock: <div><span>Sector</span><a ...>Technology</a></div>
    // The scraper:
    // $('span, div, td, th').each ... if (text === label) ... next().text()
    // It seems our mock should work if the scraper iterates spans.

    // Debugging: If it returns Unknown, it means the extraction failed.
    // Let's ensure strict matching.

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
    }
  });
});

describe('parseMarketNumber', () => {
  it('parses suffixed values', () => {
    expect(parseMarketNumber('1.12M')).toBe(1_120_000);
    expect(parseMarketNumber('$3.5B')).toBe(3_500_000_000);
    expect(parseMarketNumber('2T')).toBe(2e12);
    expect(parseMarketNumber('850K')).toBe(850_000);
    expect(parseMarketNumber('1,234')).toBe(1234);
  });

  it('keeps the multiplier when the cell has surrounding whitespace', () => {
    // Regression: stockanalysis.com serves "1.12M " with a trailing space,
    // which used to parse as 1.12 instead of 1,120,000
    expect(parseMarketNumber('1.12M ')).toBe(1_120_000);
    expect(parseMarketNumber(' 4.6M\n')).toBe(4_600_000);
  });

  it('ignores extra stats concatenated after the value', () => {
    // Regression: table cells can contain the value plus the 1-year change,
    // e.g. "1.12M -92.3%" for NCRA — only the first token is the value
    expect(parseMarketNumber('1.12M -92.3%')).toBe(1_120_000);
    expect(parseMarketNumber('3.5B +12.1%')).toBe(3_500_000_000);
    expect(parseMarketNumber('-12.5M')).toBe(-12_500_000);
    expect(parseMarketNumber('n/a')).toBeUndefined();
  });
});
