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
  marketCap?: number; // In dollars
  peRatio?: number;
  forwardPe?: number;
  dividendYield?: number; // as percentage (e.g. 0.5 for 0.5%)
  dividend?: number; // Annual dividend amount
  beta?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  sharesOutstanding?: number;
  expenseRatio?: number; // as percentage
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

                if (symbol && symbol.toLowerCase() !== 'n/a') {
                    holdings.push({
                        symbol,
                        name,
                        weight,
                        shares
                    });
                } else if (name && weight > 0) {
                     holdings.push({
                         symbol: name,
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

// Helper to parse "4.01T", "416.16B", "14.78M"
function parseMarketNumber(val: string): number | undefined {
    if (!val) return undefined;
    val = val.toUpperCase().replace('$', '').replace(/,/g, '');
    let multiplier = 1;
    if (val.endsWith('T')) {
        multiplier = 1e12;
        val = val.slice(0, -1);
    } else if (val.endsWith('B')) {
        multiplier = 1e9;
        val = val.slice(0, -1);
    } else if (val.endsWith('M')) {
        multiplier = 1e6;
        val = val.slice(0, -1);
    } else if (val.endsWith('K')) {
        multiplier = 1e3;
        val = val.slice(0, -1);
    }
    const num = parseFloat(val);
    if (isNaN(num)) return undefined;
    return num * multiplier;
}

export async function getStockProfile(ticker: string): Promise<StockProfile | null> {
  const upperTicker = ticker.toUpperCase();
  let url = `https://stockanalysis.com/stocks/${ticker.toLowerCase()}/`;
  let isEtf = false;

  let response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
  });

  if (response.status === 404) {
    url = `https://stockanalysis.com/etf/${ticker.toLowerCase()}/`;
    response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
    });
    if (response.ok) isEtf = true;
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
  // For ETFs: "Asset Class" (Sector) and "Category" (Industry)

  const extractLabelValue = (labels: string[]): string | undefined => {
      let val: string | undefined;
      $('span, div, td, th').each((_, el) => {
        if (val) return;
        const text = $(el).text().trim();
        // Exact match or starts with label:
        if (labels.includes(text) || labels.some(l => text.startsWith(l + ':'))) {
            // Check next sibling
            let next = $(el).next();
            if (next.length && next.text().trim()) {
                 val = next.text().trim();
                 return;
            }
            // Check if colon format
            if (text.includes(':')) {
                 const parts = text.split(':');
                 if (parts.length > 1 && parts[1].trim()) {
                     val = parts[1].trim();
                     return;
                 }
            }
        }
      });
      return val;
  };

  sector = extractLabelValue(['Sector', 'Asset Class']) || '';
  industry = extractLabelValue(['Industry', 'Category']) || '';

  // Fallback scan if still empty (logic from before, simplified)
  if (!sector || !industry) {
      $('div, li, tr').each((_, el) => {
        if ($(el).children().length > 5) return;
        const text = $(el).text().trim();

        if (!sector && (text === 'Sector' || text.startsWith('Sector:'))) {
            const next = $(el).next();
            if (next.length) sector = next.text().trim();
        }
        if (!industry && (text === 'Industry' || text.startsWith('Industry:'))) {
             const next = $(el).next();
            if (next.length) industry = next.text().trim();
        }
      });
  }


  // Description
  let description = '';
  $('h2, h3').each((_, el) => {
      const headerText = $(el).text().trim();
      if (headerText.includes(`About ${upperTicker}`)) {
          let next = $(el).next();
          // Skip empty nodes, BRs, and short navigation links
          let attempts = 0;
          while (next.length && attempts < 10) {
               const text = next.text().trim();
               // If we hit another header, stop
               if (next.is('h2') || next.is('h3')) break;

               // If text is substantial, assume it's the description
               if (text.length > 50) {
                   // If it's a div, try to find a p inside
                   if (next.is('div')) {
                       const p = next.find('p').first();
                       if (p.length && p.text().trim().length > 50) {
                           description = p.text().trim();
                       } else {
                           description = text;
                       }
                   } else {
                       description = text;
                   }
                   break;
               }
               next = next.next();
               attempts++;
          }
      }
  });

  if (description) {
      description = description.replace(/\[Read more\]/g, '').trim();
      if (description.endsWith('...')) description = description.slice(0, -3).trim();
  }

  if (!description) {
      const metaDesc = $('meta[name="description"]').attr('content');
      if (metaDesc && !metaDesc.startsWith("Get a real-time stock price for the")) {
          description = metaDesc;
      }
  }

  // --- Financial Metrics Scraping ---

  let marketCap: number | undefined;
  let peRatio: number | undefined;
  let forwardPe: number | undefined;
  let dividendYield: number | undefined;
  let dividend: number | undefined;
  let beta: number | undefined;
  let fiftyTwoWeekLow: number | undefined;
  let fiftyTwoWeekHigh: number | undefined;
  let sharesOutstanding: number | undefined;
  let expenseRatio: number | undefined;

  // Helper to extract value given a label
  const extractValue = (label: string): string | undefined => {
    let val: string | undefined;

    // Try finding exact text match in common elements
    $('div, td, th, span').each((_, el) => {
        if (val) return;
        const text = $(el).text().trim();
        if (text === label) {
            // Check next sibling
            let next = $(el).next();
            if (next.length) {
                val = next.text().trim();
                return;
            }
        }
    });

    if (!val) {
        // Try looking for label inside a cell in a table row, take next cell
        $('tr').each((_, tr) => {
            if (val) return;
            const cells = $(tr).find('td, th');
            cells.each((i, cell) => {
                if ($(cell).text().trim() === label) {
                    if (i + 1 < cells.length) {
                        val = $(cells[i+1]).text().trim();
                    }
                }
            });
        });
    }

    // Try scanning for text nodes if structure is messy
    if (!val) {
        $('div').each((_, el) => {
            if (val) return;
            const text = $(el).text().trim();
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
  const rawPe = extractValue('PE Ratio');
  const rawFPe = extractValue('Forward PE');
  const rawDiv = extractValue('Dividend') || extractValue('Dividend (ttm)');
  const rawDivYield = extractValue('Dividend Yield');
  const rawBeta = extractValue('Beta');
  const raw52W = extractValue('52-Week Range') || extractValue('52-Week Low');
  const rawShares = extractValue('Shares Out');
  const rawExp = extractValue('Expense Ratio');
  const raw52WHigh = extractValue('52-Week High');

  if (rawMarketCap) marketCap = parseMarketNumber(rawMarketCap);

  if (rawPe) {
      const n = parseFloat(rawPe.replace(/,/g, ''));
      if (!isNaN(n)) peRatio = n;
  }

  if (rawFPe) {
      const n = parseFloat(rawFPe.replace(/,/g, ''));
      if (!isNaN(n)) forwardPe = n;
  }

  if (rawDiv) {
      const parts = rawDiv.split('(');
      const valStr = parts[0].replace('$', '').trim();
      const n = parseFloat(valStr);
      if (!isNaN(n)) dividend = n;

      if (parts.length > 1 && !rawDivYield) {
           const yStr = parts[1].replace('%)', '').replace('%', '').trim();
           const y = parseFloat(yStr);
           if (!isNaN(y)) dividendYield = y;
      }
  }

  if (rawDivYield) {
      const y = parseFloat(rawDivYield.replace('%', '').trim());
      if (!isNaN(y)) dividendYield = y;
  }

  if (rawBeta) {
      const n = parseFloat(rawBeta);
      if (!isNaN(n)) beta = n;
  }

  if (rawShares) {
      sharesOutstanding = parseMarketNumber(rawShares);
  }

  if (rawExp) {
      const n = parseFloat(rawExp.replace('%', '').trim());
      if (!isNaN(n)) expenseRatio = n;
  }

  if (raw52W) {
      if (raw52W.includes('-')) {
          const parts = raw52W.split('-').map(s => parseFloat(s.trim().replace(/,/g, '')));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              fiftyTwoWeekLow = parts[0];
              fiftyTwoWeekHigh = parts[1];
          }
      } else {
          const n = parseFloat(raw52W.replace(/,/g, ''));
          if (!isNaN(n)) fiftyTwoWeekLow = n;
      }
  }

  if (raw52WHigh) {
       const n = parseFloat(raw52WHigh.replace(/,/g, ''));
       if (!isNaN(n)) fiftyTwoWeekHigh = n;
  }

  // Analyst Data
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
    marketCap,
    peRatio,
    forwardPe,
    dividendYield,
    dividend,
    beta,
    fiftyTwoWeekLow,
    fiftyTwoWeekHigh,
    sharesOutstanding,
    expenseRatio
  };
}
