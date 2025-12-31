import * as cheerio from 'cheerio';

const fetchWithUserAgent = async (url: string) => {
  return fetch(url, {
    headers: {
       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
       'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
       'Accept-Language': 'en-US,en;q=0.9',
       'Accept-Encoding': 'gzip, deflate, br',
       'Referer': 'https://www.google.com/',
       'Upgrade-Insecure-Requests': '1',
       'Sec-Fetch-Dest': 'document',
       'Sec-Fetch-Mode': 'navigate',
       'Sec-Fetch-Site': 'cross-site',
       'Sec-Fetch-User': '?1',
       'Cache-Control': 'max-age=0'
    }
  });
}

export async function getEtfDescription(ticker: string): Promise<string | null> {
    const url = `https://www.etf.com/${ticker.toUpperCase()}`;
    try {
        const res = await fetchWithUserAgent(url);
        // ETF.com often returns 403 to bots
        if (!res.ok) {
            console.warn(`ETF.com fetch failed for ${ticker}: ${res.status}`);
            return null;
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        let description = '';

        // Strategy: Look for "Analysis & Insights" header
        // Based on the user provided screenshot: "SLV Analysis & Insights"
        $('h2, h3, h4, h5').each((_, el) => {
            if (description) return;
            const text = $(el).text().trim();
            if (text.includes('Analysis & Insights')) {
                // Found the header.
                // The content usually follows. It might be in a sibling, or parent's sibling.

                // Case 1: Siblings (p tags directly after header)
                let next = $(el).next();
                let foundContent = false;

                // If immediate next is empty text node or whatever, skip
                while (next.length && (next.is('br') || next.text().trim() === '')) {
                     next = next.next();
                }

                if (next.is('div')) {
                    // Often wrapped in a div
                    const paragraphs = next.find('p');
                    if (paragraphs.length > 0) {
                         paragraphs.each((_, p) => {
                             description += $(p).text().trim() + '\n\n';
                         });
                         foundContent = true;
                    } else {
                        // Text directly in div?
                        const divText = next.text().trim();
                        if (divText.length > 50) {
                            description = divText;
                            foundContent = true;
                        }
                    }
                }

                if (!foundContent) {
                    // Maybe just p tags following the header
                    next = $(el).next();
                    while (next.length && !next.is('h2') && !next.is('h3') && !next.is('div[class*="module"]')) {
                        if (next.is('p')) {
                            description += next.text().trim() + '\n\n';
                        }
                        next = next.next();
                    }
                }
            }
        });

        return description.trim() || null;
    } catch (e) {
        // Suppress generic network errors for scraping to reduce noise
        // console.error('Error scraping etf.com:', e);
        return null;
    }
}
