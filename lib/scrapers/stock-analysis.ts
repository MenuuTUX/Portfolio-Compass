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

  // 2. Fallback: Meta description
  if (!description) {
      const metaDesc = $('meta[name="description"]').attr('content');
      if (metaDesc) {
          description = metaDesc;
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

          // Price Target and Consensus often in a card or sibling structure
          // "Analyst Consensus: Buy"
          // "Price Target $288.62 (6.32% upside)"

          let consensus = '';
          let targetPrice: number | null = null;
          let targetUpside: number | null = null;

          // Try to find text within the section
          // Looking for specific strings in next siblings or a container
          // The structure seen in image/text:
          // P: According to ...
          // DIV (card)
          //   Price Target $X
          //   (Y% upside)
          //   Analyst Consensus: Z

          // Let's traverse downwards or search in subsequent siblings until next header
          let container = next.next();
          // It might be a div container right after paragraph

          // Helper to parse text content from this section
          const sectionText = $(el).parent().text() + $(el).parent().next().text(); // Assuming it might be grouped

          // Regex approach on the whole section text might be easier if structure varies
          // But safer to find elements.

          // Look for "Analyst Consensus: [Value]"
          // In the image, it's text "Analyst Consensus: Buy"
          const consensusMatch = $('div').filter((_, e) => $(e).text().includes('Analyst Consensus:')).last();
          if (consensusMatch.length) {
              const text = consensusMatch.text();
              const match = text.match(/Analyst Consensus:\s*([A-Za-z\s]+)/);
              if (match) {
                  consensus = match[1].trim();
                  // Clean up if it captures too much (e.g. from chart labels)
                  // Usually it's short like "Buy", "Strong Buy", "Hold"
                  // Remove any trailing newlines or extra text if any
                  consensus = consensus.split('\n')[0].trim();
              }
          }

          // Look for Price Target
          // Often displayed as large text "$288.62"
          // Or searched via text "Price Target"
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
              const upsideEl = valEl.next(); // or nested
              // If not direct sibling, look in parent text
              // The text might be "(6.32% upside)"

              const upsideText = upsideEl.text().trim() || valEl.text().trim(); // sometimes in same line?
              const upMatch = upsideText.match(/\(([\d.-]+)%\s*(upside|downside)\)/i);
              if (upMatch) {
                  let pct = parseFloat(upMatch[1]);
                  if (upMatch[2].toLowerCase() === 'downside') {
                      pct = -pct;
                  }
                  targetUpside = pct;
              }
          } else {
             // Fallback: search for text in the summary area if specific elements not found
             // "Price Target $288.62"
             // Using Cheerio context around the header
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
