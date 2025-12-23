import * as cheerio from 'cheerio';

export interface StockProfile {
  sector: string;
  industry: string;
  description: string;
  analyst?: {
    summary: string;
    consensus: string;
    targetPrice: number | null;
    targetUpside: number | null; // as percentage
  };
}

export interface ScrapedHolding {
    symbol: string;
    name: string;
    weight: number; // as percentage decimal (e.g. 0.05 for 5%)
    shares: number | null;
}

export async function getMarketMovers(type: 'gainers' | 'losers'): Promise<string[]> {
    const url = `https://stockanalysis.com/markets/${type}/`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
    });
    if (!response.ok) {
        console.error(`Failed to fetch ${type}: ${response.status}`);
        return [];
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    const tickers: string[] = [];

    // Find the main table
    $('table').each((_, table) => {
        const headers = $(table).find('th').map((_, th) => $(th).text().trim()).get();
        // Check for expected headers to identify the correct table
        if (headers.includes('Symbol') && headers.includes('% Change')) {
            const symbolIndex = headers.indexOf('Symbol');
            if (symbolIndex > -1) {
                 $(table).find('tbody tr').each((_, tr) => {
                    const symbolCell = $(tr).find('td').eq(symbolIndex);
                    // The symbol is usually a link, so we can try to extract text
                    const ticker = symbolCell.text().trim();
                    if (ticker) tickers.push(ticker);
                 });
            }
        }
    });

    return tickers;
}

export async function getEtfHoldings(ticker: string): Promise<ScrapedHolding[]> {
    const url = `https://stockanalysis.com/etf/${ticker.toLowerCase()}/holdings/`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
    });

    if (!response.ok) {
        console.error(`Failed to fetch holdings for ${ticker}: ${response.status}`);
        return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const holdings: ScrapedHolding[] = [];

    // Find the holdings table
    // Headers: No., Symbol, Name, % Weight, Shares
    $('table').each((_, table) => {
        const headers = $(table).find('th').map((_, th) => $(th).text().trim()).get();

        const symbolIndex = headers.indexOf('Symbol');
        const nameIndex = headers.indexOf('Name');
        const weightIndex = headers.indexOf('% Weight');
        const sharesIndex = headers.indexOf('Shares');

        if (symbolIndex > -1 && weightIndex > -1) {
             $(table).find('tbody tr').each((_, tr) => {
                const tds = $(tr).find('td');
                const symbol = tds.eq(symbolIndex).text().trim();
                const name = nameIndex > -1 ? tds.eq(nameIndex).text().trim() : '';
                const weightText = tds.eq(weightIndex).text().trim();
                const sharesText = sharesIndex > -1 ? tds.eq(sharesIndex).text().trim() : '';

                let weight = 0;
                if (weightText.endsWith('%')) {
                    weight = parseFloat(weightText.replace('%', '')) / 100;
                }

                let shares: number | null = null;
                if (sharesText) {
                    const cleanShares = sharesText.replace(/,/g, '');
                    if (!isNaN(parseFloat(cleanShares))) {
                        shares = parseFloat(cleanShares);
                    }
                }

                // Sometimes symbol is 'n/a' or empty, but we might still want it if name exists?
                // Usually we need a ticker or valid identifier.
                // If symbol is 'n/a', it might be cash or something.
                if (symbol && symbol.toLowerCase() !== 'n/a') {
                    holdings.push({
                        symbol,
                        name,
                        weight,
                        shares
                    });
                } else if (name && weight > 0) {
                     // Keep entry with Name as symbol if symbol is missing (e.g. Cash)
                     holdings.push({
                         symbol: name, // Use name as symbol for display
                         name: name,
                         weight,
                         shares
                     });
                }
             });
        }
    });

    return holdings;
}

export async function getStockProfile(ticker: string): Promise<StockProfile | null> {
  const upperTicker = ticker.toUpperCase();
  // Try stock URL first
  let url = `https://stockanalysis.com/stocks/${ticker.toLowerCase()}/`;
  let response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
  });

  // Fallback to ETF if 404
  if (response.status === 404) {
    url = `https://stockanalysis.com/etf/${ticker.toLowerCase()}/`;
    response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
    });
  }

  if (!response.ok) {
    console.error(`Failed to fetch profile for ${ticker}: ${response.status}`);
    return null;
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  let sector = '';
  let industry = '';
  
  // Strategy: Look for specific labels "Sector" and "Industry"
  // Based on observation: <span>Sector</span> <a ...>Materials</a>

  // 1. Check for specific layout where label is a sibling or parent
  $('span, div').each((_, el) => {
    const text = $(el).text().trim();
    
    if (!sector && text === 'Sector') {
        const next = $(el).next();
        if (next.length) {
            sector = next.text().trim();
        }
    }

    if (!industry && text === 'Industry') {
        const next = $(el).next();
        if (next.length) {
            industry = next.text().trim();
        }
    }
  });

  // 2. Fallback: Iterate over broader elements if not found
  if (!sector || !industry) {
      $('div, li, tr').each((_, el) => {
        if ($(el).children().length > 5) return;

        const text = $(el).text().trim();

        if (!sector && (text === 'Sector' || text.startsWith('Sector:'))) {
            let value = '';
            const link = $(el).find('a').first();
            if (link.length > 0 && link.attr('href')?.includes('/sector/')) {
                value = link.text().trim();
            } else if (text.includes(':')) {
                value = text.split(':')[1].trim();
            } else {
                const next = $(el).next();
                if (next.length && next.text().trim()) {
                    value = next.text().trim();
                }
            }
            if (value) sector = value;
        }

        if (!industry && (text === 'Industry' || text.startsWith('Industry:'))) {
            let value = '';
            const link = $(el).find('a').first();
            if (link.length > 0 && link.attr('href')?.includes('/industry/')) {
                value = link.text().trim();
            } else if (text.includes(':')) {
                value = text.split(':')[1].trim();
            } else {
                const next = $(el).next();
                if (next.length && next.text().trim()) {
                    value = next.text().trim();
                }
            }
            if (value) industry = value;
        }
      });
  }

  // Description
  // Look for "About {Ticker}" header
  let description = '';
  
  // 1. Try "About {Ticker}" header
  $('h2, h3').each((_, el) => {
      const headerText = $(el).text().trim();
      if (headerText.includes(`About ${upperTicker}`)) {
          // The description is usually the next paragraph
          // It might be in a sibling div or direct sibling p
          let next = $(el).next();
          // Skip empty text nodes or non-content elements
          while (next.length && (next.is('br') || next.text().trim() === '')) {
              next = next.next();
          }
          
          if (next.is('p')) {
              description = next.text().trim();
          } else if (next.is('div')) {
              // Sometimes wrapped in a div
              description = next.find('p').first().text().trim();
              if (!description) description = next.text().trim();
          }
      }
  });

  // Remove [Read more] artifact
  if (description) {
      description = description.replace(/\[Read more\]/g, '').trim();
      // Remove trailing ellipsis if it was part of read more
      if (description.endsWith('...')) {
          description = description.slice(0, -3).trim();
      }
  }

  // 2. Fallback: Meta description
  if (!description) {
      const metaDesc = $('meta[name="description"]').attr('content');
      if (metaDesc) {
          // Check if it's a generic SEO description
          const isGeneric = metaDesc.startsWith("Get a real-time stock price for the");
          if (!isGeneric) {
              description = metaDesc;
          }
      }
  }

  // Analyst Data
  // Look for "Analyst Summary" section
  let analyst: StockProfile['analyst'] | undefined;

  $('h2, h3').each((_, el) => {
      const headerText = $(el).text().trim();
      if (headerText === 'Analyst Summary') {
          // The summary text is usually the next paragraph
          let summary = '';
          let next = $(el).next();
          while (next.length && (next.is('br') || next.text().trim() === '')) {
              next = next.next();
          }
          if (next.is('p')) {
              summary = next.text().trim();
          }

          let consensus = '';
          let targetPrice: number | null = null;
          let targetUpside: number | null = null;

          // Look for "Analyst Consensus: [Value]"
          const consensusMatch = $('div').filter((_, e) => $(e).text().includes('Analyst Consensus:')).last();
          if (consensusMatch.length) {
              const text = consensusMatch.text();
              const match = text.match(/Analyst Consensus:\s*([A-Za-z\s]+)/);
              if (match) {
                  consensus = match[1].trim();
                  consensus = consensus.split('\n')[0].trim();
              }
          }

          // Look for Price Target
          const targetLabel = $('div').filter((_, e) => $(e).text().trim() === 'Price Target').last();
          if (targetLabel.length) {
              // The value is likely the next sibling or close by
              const valEl = targetLabel.next();
              const valText = valEl.text().trim();
              // Remove $ and parse
              const valMatch = valText.match(/\$([\d,.]+)/);
              if (valMatch) {
                  targetPrice = parseFloat(valMatch[1].replace(/,/g, ''));
              }

              // Upside/Downside is usually next
              const upsideEl = valEl.next();
              const upsideText = upsideEl.text().trim() || valEl.text().trim();
              const upMatch = upsideText.match(/\(([\d.-]+)%\s*(upside|downside)\)/i);
              if (upMatch) {
                  let pct = parseFloat(upMatch[1]);
                  if (upMatch[2].toLowerCase() === 'downside') {
                      pct = -pct;
                  }
                  targetUpside = pct;
              }
          } else {
             // Fallback
             const container = $(el).nextAll('div').first();
             const text = container.text();

             if (!consensus) {
                 const cMatch = text.match(/Analyst Consensus:\s*([A-Za-z\s]+)/);
                 if (cMatch) consensus = cMatch[1].trim();
             }
             if (!targetPrice) {
                 const pMatch = text.match(/Price Target\s*\$([\d,.]+)/);
                 if (pMatch) targetPrice = parseFloat(pMatch[1].replace(/,/g, ''));
             }
             if (targetUpside === null) {
                  const uMatch = text.match(/\(([\d.-]+)%\s*(upside|downside)\)/i);
                  if (uMatch) {
                      let pct = parseFloat(uMatch[1]);
                      if (uMatch[2].toLowerCase() === 'downside') pct = -pct;
                      targetUpside = pct;
                  }
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
    analyst
  };
}
