import { parse } from 'csv-parse/sync';
import { Decimal } from 'decimal.js';

interface ISharesHolding {
  ticker: string;
  name: string;
  sector: string;
  weight: Decimal;
  shares: Decimal;
}

const PRODUCT_IDS: Record<string, string> = {
  'XEQT': '308188',
  'XIC': '239837',
  'XIU': '239832',
  'XIU.TO': '239832',
};

export function isSupportedIShares(ticker: string): boolean {
  return ticker.toUpperCase() in PRODUCT_IDS;
}

// Map to normalize CSV headers to our expected keys
const HEADER_MAP: Record<string, string> = {
  'Ticker': 'ticker',
  'Symbol': 'ticker',
  'Name': 'name',
  'Security Name': 'name',
  'Sector': 'sector',
  'Weight (%)': 'weight',
  '% Net Assets': 'weight',
  'Shares': 'shares',
  'Market Value': 'marketValue',
  'ISIN': 'isin',
  'SEDOL': 'sedol',
  'Exchange': 'exchange'
};

export async function fetchISharesHoldings(ticker: string): Promise<ISharesHolding[]> {
  const upperTicker = ticker.toUpperCase();
  const productId = PRODUCT_IDS[upperTicker];

  if (!productId) {
    throw new Error(`Unsupported iShares ETF ticker: ${ticker}. Please add its Product ID to the lookup.`);
  }

  const url = `https://www.ishares.com/ca/products/${productId}/fund/1467271812596.ajax?fileType=csv&fileName=${upperTicker}_holdings&dataType=fund`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/csv,application/json,application/xml,text/plain',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch holdings for ${ticker}: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();

    // The CSV usually has a preamble. We need to find the header row.
    // Common headers start with "Ticker" or "Symbol"
    const lines = csvText.split('\n');
    let headerRowIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('Ticker') || line.startsWith('Symbol') || line.includes('Security Name')) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error(`Could not find header row in CSV for ${ticker}`);
    }

    // Extract the relevant part of the CSV starting from the header
    const csvContent = lines.slice(headerRowIndex).join('\n');

    const records = parse(csvContent, {
      columns: (header) => header.map((h: string) => {
        const cleanHeader = h.trim();
        return HEADER_MAP[cleanHeader] || cleanHeader; // Normalize or keep original
      }),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true, // Handle trailing commas or extra columns
    });

    const holdings: ISharesHolding[] = records
      .map((record: any) => {
        // Validation: Ensure essential fields exist
        if (!record.ticker || !record.name || !record.weight) {
          return null;
        }

        // Clean up weight (remove '%' if present)
        let weightStr = record.weight;
        if (typeof weightStr === 'string') {
          weightStr = weightStr.replace('%', '').trim();
        }

        // Clean up shares (remove commas)
        let sharesStr = record.shares || '0';
        if (typeof sharesStr === 'string') {
            sharesStr = sharesStr.replace(/,/g, '').trim();
        }

        return {
          ticker: record.ticker,
          name: record.name,
          sector: record.sector || 'Unknown',
          weight: new Decimal(weightStr || 0),
          shares: new Decimal(sharesStr || 0),
        };
      })
      .filter((h: ISharesHolding | null): h is ISharesHolding => h !== null);

    return holdings;

  } catch (error) {
    console.error(`Error fetching iShares holdings for ${ticker}:`, error);
    throw error;
  }
}
