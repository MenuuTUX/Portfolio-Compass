import * as cheerio from 'cheerio';

export interface StockProfile {
  sector: string;
  industry: string;
  description: string;
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
  
  // Strategy: Find text node "Sector" or "Industry" in the overview section
  // Usually presented as "Sector: [Link]" or in a grid
  // We want to avoid navigation links like "By Industry"
  
  // Refined Strategy:
  // Look for text nodes that exactly start with "Sector" or "Industry" followed by a colon or are separate labels.
  // Or look for known containers if possible, but generic is better if careful.
  
  $('div, li, tr').each((_, el) => {
    // Avoid checking massive containers, check for leaf-ish nodes
    if ($(el).children().length > 5) return;

    const text = $(el).text().trim();
    
    // Check for "Sector"
    // Use regex to be more specific: ^Sector\b or similar
    if (!sector && (text === 'Sector' || text.startsWith('Sector:'))) {
        // Case 1: "Sector: Technology" (text only)
        // Case 2: "Sector" [Link "Technology"] (sibling or child)
        
        let value = '';
        const link = $(el).find('a').first();
        if (link.length > 0 && link.attr('href')?.includes('/sector/')) {
            value = link.text().trim();
        } else if (text.includes(':')) {
            value = text.split(':')[1].trim();
        } else {
             // Maybe sibling?
             // e.g. <div>Sector</div><div>Technology</div>
             const next = $(el).next();
             if (next.length && next.text().trim()) {
                 value = next.text().trim();
             }
        }
        
        if (value) sector = value;
    }
    
    // Check for "Industry"
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

  // 2. Fallback: Meta description
  if (!description) {
      const metaDesc = $('meta[name="description"]').attr('content');
      if (metaDesc) {
          description = metaDesc;
      }
  }

  return {
    sector,
    industry,
    description
  };
}
