import * as cheerio from 'cheerio';
import { isValidTicker } from "@/lib/validators";

interface StockProfile {
  sector: string;
  industry: string;
  description: string;
  analyst?: {
    summary: string;
    consensus: string;
    targetPrice: number | null;
    targetUpside: number | null;
  };
  [key: string]: any;
}

const STOCK_ANALYSIS_HEADERS = {
   'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
   'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
   'Accept-Language': 'en-US,en;q=0.9',
   'Accept-Encoding': 'gzip, deflate, br, zstd',
   'Referer': 'https://www.google.com/',
   'Upgrade-Insecure-Requests': '1',
   'Sec-Fetch-Dest': 'document',
   'Sec-Fetch-Mode': 'navigate',
   'Sec-Fetch-Site': 'none',
   'Sec-Fetch-User': '?1',
   'Cache-Control': 'max-age=0',
   'Priority': 'u=0, i'
};

const fetchWithUserAgent = async (url: string) => {
  return fetch(url, {
    headers: STOCK_ANALYSIS_HEADERS
  });
}

export async function getMarketMovers(type: 'gainers' | 'losers'): Promise<string[]> {
  const url = `https://stockanalysis.com/markets/${type}/`;
  const res = await fetchWithUserAgent(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch market movers: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const tickers: string[] = [];

  // StockAnalysis movers table usually has tickers in the second column (td.sym or similar)
  // We'll look for standard table rows
  $('table tr').each((i, el) => {
    if (i === 0) return; // Skip header

    // Attempt to find the ticker cell
    const symbolCell = $(el).find('td').filter((_, td) => {
      const text = $(td).text().trim();
      // Tickers are usually short, uppercase, no spaces (maybe dots)
      return /^[A-Z.-]+$/.test(text) && text.length < 10;
    }).first();

    if (symbolCell.length) {
      tickers.push(symbolCell.text().trim());
    }
  });

  // Limit to top 20
  return tickers.slice(0, 20);
}

export async function getStockProfile(ticker: string): Promise<StockProfile> {
  if (!isValidTicker(ticker)) {
    throw new Error("Invalid ticker format");
  }

  // Handle TSX/NEO suffixes for StockAnalysis URLs
  // They use /quote/tsx/ticker or /quote/neo/ticker structure
  let urlTicker = ticker.toLowerCase();
  let exchangePrefix = '';

  if (urlTicker.endsWith('.to')) {
      urlTicker = urlTicker.replace('.to', '');
      exchangePrefix = 'tsx/';
  } else if (urlTicker.endsWith('.ne')) {
      urlTicker = urlTicker.replace('.ne', '');
      exchangePrefix = 'neo/';
  }

  const url = `https://stockanalysis.com/stocks/${exchangePrefix}${urlTicker}/profile/`;

  const res = await fetchWithUserAgent(url);
  if (!res.ok) {
     // If stock fail, try generic ETF url structure
     // StockAnalysis uses /etf/ticker for ETFs
     const etfUrl = `https://stockanalysis.com/etf/${exchangePrefix}${urlTicker}/`;
     const etfRes = await fetchWithUserAgent(etfUrl);
     if (!etfRes.ok) {
         throw new Error(`Failed to fetch profile for ${ticker}`);
     }
     return parseProfile(await etfRes.text(), true);
  }

  return parseProfile(await res.text(), false);
}

function parseProfile(html: string, isEtf: boolean): StockProfile {
  const $ = cheerio.load(html);

  // Basic Info
  let description = '';
  // StockAnalysis puts description in a predictable div structure, often after the header
  const aboutHeader = $('h2').filter((_, el) => $(el).text().includes('About'));
  if (aboutHeader.length) {
      description = aboutHeader.next('p').text().trim();
  }

  // If failed, try generic meta description or first paragraph
  if (!description) {
      description = $('meta[name="description"]').attr('content') || '';
  }

  // Info Table (Sector, Industry)
  let sector = 'Unknown';
  let industry = 'Unknown';

  // Table rows in the profile section
  $('table tr').each((_, el) => {
      const label = $(el).find('td').first().text().trim();
      const val = $(el).find('td').last().text().trim();

      if (label === 'Sector' || label === 'Asset Class') sector = val;
      if (label === 'Industry' || label === 'Category') industry = val;
  });

  // Extract Financial Metrics
  const metrics: any = {};

  // Helper to parse "1.23B", "45.6M", etc.
  const parseMarketNumber = (str: string): number | null => {
      if (!str || str === '-') return null;
      const clean = str.replace(/[$,]/g, '').trim();
      const lastChar = clean.slice(-1).toUpperCase();
      const val = parseFloat(clean.slice(0, -1));

      if (isNaN(val)) {
          // Try parsing without suffix
          const raw = parseFloat(clean);
          return isNaN(raw) ? null : raw;
      }

      if (lastChar === 'T') return val * 1e12;
      if (lastChar === 'B') return val * 1e9;
      if (lastChar === 'M') return val * 1e6;
      if (lastChar === 'K') return val * 1e3;

      // If it ends in %, it's a percentage (e.g. Yield)
      if (lastChar === '%') return val;

      return parseFloat(clean);
  };

  const extractValue = (label: string): string | null => {
    let val: string | null = null;
    // Look in all tables
    $('table tr').each((_, el) => {
        const rowLabel = $(el).find('td').first().text().trim();
        if (rowLabel === label) {
            val = $(el).find('td').last().text().trim();
        }
    });

    // Also check overview cards if tables fail
    if (!val) {
        $('div').each((_, el) => {
            const text = $(el).text().trim();
            // Heuristic: "Market Cap 1.23B"
            if (text.startsWith(label) && text.length < label.length + 20) {
                 const part = text.substring(label.length).trim();
                 if (part && !part.includes('\n')) {
                    val = part;
                 }
            }
        });
    }
    return val;
  };

  const rawMarketCap = extractValue('Market Cap') || extractValue('Assets');
  if (rawMarketCap) metrics.marketCap = parseMarketNumber(rawMarketCap);

  const rawRevenue = extractValue('Revenue (ttm)');
  if (rawRevenue) metrics.revenue = parseMarketNumber(rawRevenue);

  const rawNetIncome = extractValue('Net Income (ttm)');
  if (rawNetIncome) metrics.netIncome = parseMarketNumber(rawNetIncome);

  const rawShares = extractValue('Shares Out');
  if (rawShares) metrics.sharesOutstanding = parseMarketNumber(rawShares);

  const rawEps = extractValue('EPS (ttm)');
  if (rawEps) {
      const n = parseFloat(rawEps.replace(/,/g, ''));
      if (!isNaN(n)) metrics.eps = n;
  }

  const rawPe = extractValue('PE Ratio');
  if (rawPe) {
      const n = parseFloat(rawPe.replace(/,/g, ''));
      if (!isNaN(n)) metrics.peRatio = n;
  }

  const rawFPe = extractValue('Forward PE');
  if (rawFPe) {
      const n = parseFloat(rawFPe.replace(/,/g, ''));
      if (!isNaN(n)) metrics.forwardPe = n;
  }

  const rawDiv = extractValue('Dividend') || extractValue('Dividend (ttm)');
  if (rawDiv) {
      const parts = rawDiv.split('(');
      const valStr = parts[0].replace('$', '').trim();
      const n = parseFloat(valStr);
      if (!isNaN(n)) metrics.dividend = n;

      if (parts.length > 1) {
           const yStr = parts[1].replace('%)', '').replace('%', '').trim();
           const y = parseFloat(yStr);
           if (!isNaN(y)) metrics.dividendYield = y;
      }
  }

  const rawDivYield = extractValue('Dividend Yield');
  if (rawDivYield) {
      const y = parseFloat(rawDivYield.replace('%', '').trim());
      if (!isNaN(y)) metrics.dividendYield = y;
  }

  const rawDivGrowth = extractValue('Dividend Growth (5Y)') || extractValue('5-Year Dividend Growth');
  if (rawDivGrowth) {
      const y = parseFloat(rawDivGrowth.replace('%', '').trim());
      if (!isNaN(y)) metrics.dividendGrowth5Y = y;
  }

  const rawExDiv = extractValue('Ex-Dividend Date');
  if (rawExDiv) metrics.exDividendDate = rawExDiv;

  const rawVolume = extractValue('Volume');
  if (rawVolume) metrics.volume = parseMarketNumber(rawVolume);

  const rawOpen = extractValue('Open');
  if (rawOpen) {
       const n = parseFloat(rawOpen.replace(/,/g, ''));
       if (!isNaN(n)) metrics.open = n;
  }

  const rawPrevClose = extractValue('Previous Close');
  if (rawPrevClose) {
       const n = parseFloat(rawPrevClose.replace(/,/g, ''));
       if (!isNaN(n)) metrics.previousClose = n;
  }

  const rawDaysRange = extractValue("Day's Range");
  if (rawDaysRange) metrics.daysRange = rawDaysRange;

  const raw52Range = extractValue('52-Week Range');
  if (raw52Range) metrics.fiftyTwoWeekRange = raw52Range;

  const rawBeta = extractValue('Beta');
  if (rawBeta) {
      const n = parseFloat(rawBeta);
      if (!isNaN(n)) metrics.beta = n;
  }

  const rawEarnings = extractValue('Earnings Date');
  if (rawEarnings) metrics.earningsDate = rawEarnings;

  const rawExp = extractValue('Expense Ratio');
  if (rawExp) {
      const n = parseFloat(rawExp.replace('%', '').trim());
      if (!isNaN(n)) metrics.expenseRatio = n;
  }

  const rawInception = extractValue('Inception Date');
  if (rawInception) metrics.inceptionDate = rawInception;

  const rawPayoutFreq = extractValue('Payout Frequency');
  if (rawPayoutFreq) metrics.payoutFrequency = rawPayoutFreq;

  const rawPayoutRatio = extractValue('Payout Ratio');
  if (rawPayoutRatio) {
      const n = parseFloat(rawPayoutRatio.replace('%', '').trim());
      if (!isNaN(n)) metrics.payoutRatio = n;
  }

  const rawHoldings = extractValue('Holdings');
  if (rawHoldings) {
      const n = parseInt(rawHoldings.replace(/,/g, ''), 10);
      if (!isNaN(n)) metrics.holdingsCount = n;
  }

  if (metrics.fiftyTwoWeekRange && metrics.fiftyTwoWeekRange.includes('-')) {
      const parts = metrics.fiftyTwoWeekRange.split('-').map((s: string) => parseFloat(s.trim().replace(/,/g, '')));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          metrics.fiftyTwoWeekLow = parts[0];
          metrics.fiftyTwoWeekHigh = parts[1];
      }
  }

  let analyst: StockProfile['analyst'] | undefined;

  $('h2, h3').each((_, el) => {
      const headerText = $(el).text().trim();
      if (headerText === 'Analyst Summary') {
          let summary = '';
          let next = $(el).next();
          while (next.length && (next.is('br') || next.text().trim() === '')) {
              next = next.next();
          }
          if (next.is('p')) summary = next.text().trim();

          let consensus = '';
          let targetPrice: number | null = null;
          let targetUpside: number | null = null;

          const consensusMatch = $('div').filter((_, e) => $(e).text().includes('Analyst Consensus:')).last();
          if (consensusMatch.length) {
              const text = consensusMatch.text();
              const match = text.match(/Analyst Consensus:\s*([A-Za-z\s]+)/);
              if (match) consensus = match[1].trim().split('\n')[0].trim();
          }

          const targetLabel = $('div').filter((_, e) => $(e).text().trim() === 'Price Target').last();
          if (targetLabel.length) {
              const valEl = targetLabel.next();
              const valMatch = valEl.text().trim().match(/\$([\d,.]+)/);
              if (valMatch) targetPrice = parseFloat(valMatch[1].replace(/,/g, ''));

              const upsideEl = valEl.next();
              const upsideText = upsideEl.text().trim() || valEl.text().trim();
              const upMatch = upsideText.match(/\(([\d.-]+)%\s*(upside|downside)\)/i);
              if (upMatch) {
                  let pct = parseFloat(upMatch[1]);
                  if (upMatch[2].toLowerCase() === 'downside') pct = -pct;
                  targetUpside = pct;
              }
          }

          if (summary || consensus || targetPrice) {
            analyst = {
                summary,
                consensus,
                targetPrice,
                targetUpside
            };
          }
      }
  });

  return {
    sector,
    industry,
    description,
    analyst,
    ...metrics
  };
}
