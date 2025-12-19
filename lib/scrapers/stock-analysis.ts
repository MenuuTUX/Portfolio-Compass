import * as cheerio from 'cheerio';

export interface StockProfile {
  ticker: string;
  sector?: string;
  industry?: string;
  description?: string;
}

export async function getStockProfile(ticker: string): Promise<StockProfile> {
  const stockUrl = `https://stockanalysis.com/stocks/${ticker.toLowerCase()}/company/`;
  const etfUrl = `https://stockanalysis.com/etf/${ticker.toLowerCase()}/`;

  let html = '';

  try {
    // Try Stock URL first
    let res = await fetch(stockUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      next: { revalidate: 3600 }
    });

    if (res.status === 404) {
      // Fallback to ETF URL
      console.log(`Stock profile not found for ${ticker}, trying ETF URL...`);
      res = await fetch(etfUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        next: { revalidate: 3600 }
      });
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch profile for ${ticker}: ${res.status} ${res.statusText}`);
    }

    html = await res.text();
  } catch (error) {
    console.error(`Error scraping stock profile for ${ticker}:`, error);
    throw error;
  }

  const $ = cheerio.load(html);
  const main = $('main').length ? $('main') : $('body');

  let sector: string | undefined;
  let industry: string | undefined;
  let description: string | undefined;

  // 1. Sector & Industry
  // Exclude general navigation links by ensuring the href is specific
  const sectorLink = main.find('a[href*="/sector/"]').filter((_, el) => {
      const href = $(el).attr('href');
      if (!href) return false;
      // Filter out general links like /stocks/sector/
      return !href.endsWith('/sector/') && !href.endsWith('/sector');
  }).first();

  if (sectorLink.length) {
      sector = sectorLink.text().trim();
  }

  const industryLink = main.find('a[href*="/industry/"]').filter((_, el) => {
      const href = $(el).attr('href');
      if (!href) return false;
      return !href.endsWith('/industry/') && !href.endsWith('/industry');
  }).first();

  if (industryLink.length) {
      industry = industryLink.text().trim();
  }

  // Fallback for Sector/Industry (e.g., table cells) if not found in links
  if (!sector) {
      main.find('td, div, span').each((_, el) => {
          if ($(el).text().trim() === 'Sector') {
              sector = $(el).next().text().trim() || $(el).siblings().last().text().trim();
              if (sector) return false; // break if found
          }
      });
  }

  if (!industry) {
      main.find('td, div, span').each((_, el) => {
          if ($(el).text().trim() === 'Industry') {
              industry = $(el).next().text().trim() || $(el).siblings().last().text().trim();
              if (industry) return false;
          }
      });
  }


  // 2. Description
  // Look for "About [Ticker]" or "Company Description" or "Fund Description"
  const descriptionHeader = main.find('h2, h3').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return text.includes('about') || text.includes('company description') || text.includes('fund description');
  }).first();

  if (descriptionHeader.length) {
    const paragraphs: string[] = [];
    let next = descriptionHeader.next();
    let siblingCount = 0;

    // Iterate through siblings to find paragraphs
    // Stop if we hit a new section header or go too far
    while (next.length && siblingCount < 15) {
        // Stop at next header
        if (next.is('h2') || next.is('h3') || next.is('h4')) {
            break;
        }

        if (next.is('p')) {
            const text = next.text().trim();
            if (text) paragraphs.push(text);
        }

        next = next.next();
        siblingCount++;
    }

    if (paragraphs.length > 0) {
      description = paragraphs.join('\n\n');
    }
  }

  // Fallback to meta description
  if (!description) {
    description = $('meta[name="description"]').attr('content');
  }

  return {
    ticker: ticker.toUpperCase(),
    sector,
    industry,
    description
  };
}
