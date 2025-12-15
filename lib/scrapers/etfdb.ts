import * as cheerio from 'cheerio';
import { Decimal } from 'decimal.js';

export interface ScrapedHolding {
  symbol: string;
  name: string;
  weight: Decimal;
}

export async function scrapeETFDBHoldings(ticker: string): Promise<ScrapedHolding[]> {
  try {
    const url = `https://etfdb.com/etf/${ticker}/#holdings`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error(`[ETFDB Scraper] Failed to fetch ${url}: ${response.statusText}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const holdings: ScrapedHolding[] = [];

    // Target the holdings table
    const table = $('table[data-hash="etf-holdings"]');

    if (table.length === 0) {
       console.warn(`[ETFDB Scraper] Holdings table not found for ${ticker}`);
       return [];
    }

    const rows = table.find('tbody tr');

    rows.each((_, row) => {
      const cols = $(row).find('td');
      if (cols.length >= 3) {
        // ETFDB usually has: Symbol | Name | % Weight
        const symbol = $(cols[0]).text().trim();
        const name = $(cols[1]).text().trim();
        const weightStr = $(cols[2]).text().trim().replace('%', '');

        const weight = new Decimal(weightStr || 0);

        if (symbol && name) {
          holdings.push({ symbol, name, weight });
        }
      }
    });

    // Return top 15
    return holdings.slice(0, 15);

  } catch (error) {
    console.error(`[ETFDB Scraper] Error scraping ${ticker}:`, error);
    return [];
  }
}
