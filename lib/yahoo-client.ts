import YahooFinance from 'yahoo-finance2';
import { MarketSnapshotItem, EtfDetails } from '@/types/yahoo';

// Instantiate the client as per v3 docs
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
});

export const getSP500Tickers = async (): Promise<string[]> => {
  try {
    const response = await fetch('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies');
    const html = await response.text();
    // Rough regex to find symbols in the table
    // Looking for <a href="..." ...>SYMBOL</a> inside the first table or similar structure
    // The python script relied on pd.read_html looking for "Symbol" column.

    // We can look for the specific link pattern in the table.
    // The symbols are usually links like <a href="/wiki/Ticker_symbol" ...>MMM</a>
    // But simplistic regex might be enough.
    // Actually, S&P 500 tickers are Uppercase, 1-5 chars, maybe dot.

    // Let's try to find the "Symbol" column content.
    // We can rely on the fact that they are in the first table.
    // We can split by <tr> and find the first <td> (or <th>?).
    // In wiki table: <tr> <td><a ...>MMM</a></td> ...

    // Since we don't have a DOM parser, we'll do best effort regex.
    // Pattern: <td><a rel="nofollow" class="external text" href="[^"]+">([A-Z0-9\.]+)</a></td>
    // Or just <td><a ...>([A-Z\.]+)</a></td>

    const regex = /<a rel="nofollow" class="external text" href="[^"]+">([A-Z0-9\.]+)<\/a>/g;
    const matches = [...html.matchAll(regex)];

    let tickers = matches.map(m => m[1]);

    // Replace dots with dashes for yfinance compatibility (BRK.B -> BRK-B)
    tickers = tickers.map(t => t.replace(/\./g, '-'));

    // Deduplicate
    return Array.from(new Set(tickers));
  } catch (e) {
    console.error('Error fetching S&P 500 tickers:', e);
    return [];
  }
};

export const getTopETFs = (): string[] => {
  return [
    // US Broad Market
    'SPY', 'IVV', 'VOO', 'VTI', 'QQQ', 'VEA', 'VTV', 'IEFA', 'BND', 'AGG',
    'VUG', 'VIG', 'IJR', 'IWF', 'VWO', 'IJH', 'VGT', 'XLK', 'IWM', 'GLD',
    // Canadian Broad Market (TSX)
    'XIU.TO', 'XIC.TO', 'VFV.TO', 'VUN.TO', 'XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO',
    'ZEB.TO', 'VDY.TO', 'ZSP.TO', 'HQU.TO', 'HOU.TO', 'HOD.TO', 'HNU.TO',
    'ZAG.TO', 'XBB.TO', 'VAB.TO', 'XSP.TO', // Removed duplicate XIU.TO
    // Sector / Thematic
    'XLV', 'XLF', 'XLY', 'XLP', 'XLE', 'XLI', 'XLB', 'XLRE', 'XLU', 'SMH'
  ];
};

export const getMag7Tickers = (): string[] => {
  return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
};

export const getJustBuyTickers = (): string[] => {
  return ['XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO', 'VFV.TO', 'VUN.TO', 'ZEB.TO'];
};

export const fetchMarketSnapshot = async (tickers: string[]): Promise<MarketSnapshotItem[]> => {
  if (!tickers.length) return [];

  // Deduplicate and clean
  const uniqueTickers = Array.from(new Set(tickers.map(t => t.trim().toUpperCase()).filter(Boolean)));

  if (uniqueTickers.length === 0) return [];

  try {
    // Quote can accept array.
    // If array is too large, we might need to chunk it?
    // yfinance2 docs don't specify limit, but let's be safe with chunking if needed.
    // For now, assume it handles reasonable batch size.

    // Actually, `yahoo-finance2` might throw if some tickers are invalid in the batch?
    // "If you pass an array of symbols, you will get an array of results. If any symbol is invalid, it will be ignored (not included in the results)." - from experience/docs

    // Wait, testing `quote(['AAPL', 'INVALID'])` might be good.
    // If `yahoo-finance2` throws on partial failure, we need to handle it.
    // Typically it returns what it finds.

    const quotes = await yahooFinance.quote(uniqueTickers, { validateResult: false });
    // validateResult: false might be safer if we expect missing fields

    const results: MarketSnapshotItem[] = quotes.map((q: any) => {
      // Map fields
      const price = q.regularMarketPrice || q.regularMarketPreviousClose || 0.0;
      const dailyChangeRaw = q.regularMarketChangePercent || 0.0;

      // yfinance2 returns percentage as number, e.g. 1.09 for 1.09% (based on test output)
      // "regularMarketChangePercent": 1.0914857
      // The python script had logic:
      // if abs(daily_change_raw) > 0.5: daily_change = daily_change_raw
      // else: daily_change = daily_change_raw * 100
      // It seems yfinance (python) returned decimals (0.0109) sometimes?
      // With yahoo-finance2, it seems to be already percentage (1.09).
      // So we can use it directly?
      // Let's stick to the python logic to be safe if it handles mixed cases,
      // but strictly speaking, `yahoo-finance2` `regularMarketChangePercent` is percentage.

      const dailyChange = dailyChangeRaw; // Assume percentage

      const name = q.shortName || q.longName || q.symbol;
      const quoteType = q.quoteType || "ETF";
      const assetType = quoteType === "EQUITY" ? "STOCK" : "ETF";

      // Yield
      // "trailingAnnualDividendYield": 0.0036... (decimal)
      // "dividendYield": 0.37 (percentage? No, usually yield is decimal 0.0037 or 3.7?)
      // Wait, in the test output: "trailingAnnualDividendYield": 0.003602967 (0.36%)
      // "dividendYield": 0.37 (wait, is this 37%? No. Is it 0.37%? likely)
      // The python script says: "if yield_raw > 0.5: val else val * 100".
      // If `dividendYield` is 0.37, that's huge if it's 37%. If it's 0.37, it's 37%.
      // Actually `dividendYield` in yfinance is often decimal.
      // But let's check AAPL. 0.36% yield.
      // If `dividendYield` is 0.37... that doesn't match 0.0036 unless it's scaled differently?
      // Wait, let's look at `trailingAnnualDividendYield` 0.0036. This is 0.36%.
      // If I convert 0.0036 * 100 = 0.36.

      // Let's prioritize `trailingAnnualDividendYield` if available, else `dividendYield`.
      // And we want percentage in the output (e.g. 1.5 for 1.5%).

      let yieldVal = 0;
      const yieldRaw = q.trailingAnnualDividendYield ?? q.dividendYield ?? 0;

      // If it's decimal (e.g. 0.05), we want 5.0.
      // If it's already percentage (e.g. 5.0), we keep it.
      // Heuristic: if > 0.5, assume percentage (unless it's a super high yield asset, but >50% yield is rare).

      if (yieldRaw > 0.5) {
        yieldVal = yieldRaw;
      } else {
        yieldVal = yieldRaw * 100;
      }

      // MER
      // `annualReportExpenseRatio` or `expenseRatio`.
      // Usually decimal e.g. 0.0003 for 0.03%.
      const merRaw = q.annualReportExpenseRatio ?? q.expenseRatio ?? 0;
      const merVal = merRaw * 100;

      return {
        ticker: q.symbol,
        name,
        price,
        daily_change: dailyChange,
        asset_type: assetType,
        yield: yieldVal,
        mer: merVal
      };
    });

    return results;

  } catch (e) {
    console.error('Batch fetch error:', e);
    return [];
  }
};

export const fetchEtfDetails = async (tickerSymbol: string): Promise<EtfDetails | null> => {
  try {
    // 1. Fetch Summary
    // We might need multiple modules to get all data
    // quote, quoteType, summaryDetail, defaultKeyStatistics, assetProfile, fundProfile?
    // yahoo-finance2 `quoteSummary` is powerful.

    // "price" -> price
    // "summaryDetail" -> yield, etc.
    // "fundProfile" -> sector weights (for ETFs)
    // "topHoldings" -> sector weights?
    // "assetProfile" -> sectors (for stocks?)

    const summary = await yahooFinance.quoteSummary(tickerSymbol, {
      modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'assetProfile', 'fundProfile', 'topHoldings']
    });

    const priceMod = summary.price;
    const summaryDetail = summary.summaryDetail;
    const assetProfile = summary.assetProfile;
    // fundProfile is deprecated/empty often? let's see.
    // topHoldings has sectorWeightings.

    if (!priceMod) throw new Error("No price data found");

    const price = priceMod.regularMarketPrice || 0;
    const dailyChangeRaw = priceMod.regularMarketChangePercent || 0;
    const dailyChange = dailyChangeRaw * 100; // Wait, we said quote returns percent.
    // In `quoteSummary`, `regularMarketChangePercent` is usually decimal 0.01 for 1% ?
    // Let's verify. The `quote` endpoint returned 1.09 for 1.09%.
    // `quoteSummary` structure is slightly different.
    // Actually, let's use the `quote` logic for price/change to be consistent if possible,
    // or assume it's same as `quote`.
    // Let's assume `regularMarketChangePercent` is a raw number.
    // If it's from `price` module, it acts like `quote`.

    const currency = priceMod.currency || "USD";
    const exchange = priceMod.exchangeName || "Unknown";
    const name = priceMod.shortName || priceMod.longName || tickerSymbol;
    const quoteType = priceMod.quoteType || "ETF";
    const assetType = quoteType === "EQUITY" ? "STOCK" : "ETF";

    // Yield
    const yieldRaw = summaryDetail?.dividendYield || summaryDetail?.trailingAnnualDividendYield || 0;
    let yieldVal = 0;
    if (yieldRaw > 0.5) yieldVal = yieldRaw;
    else yieldVal = yieldRaw * 100;

    // MER
    // fundProfile has fees?
    // topHoldings has expenseRatio? No.
    // It's usually in `fundProfile`.
    // But `fundProfile` is often missing.
    // In `quote`, we saw `annualReportExpenseRatio`.
    // Maybe we should call `quote` as well for fields missing in summary?
    // Or just trust `summaryDetail`?
    // `summaryDetail` has no expense ratio.
    // Let's call `quote(tickerSymbol)` separately to get everything `quote` gives (MER, etc).

    const quoteData = await yahooFinance.quote(tickerSymbol);
    const merRaw = quoteData.annualReportExpenseRatio ?? quoteData.expenseRatio ?? 0;
    const mer = merRaw * 100;

    // Sectors
    let sectors: Array<{ sector_name: string; weight: number }> = [];

    // For ETFs: `topHoldings` -> `sectorWeightings`
    const sectorWeightings = summary.topHoldings?.sectorWeightings;
    if (sectorWeightings && Array.isArray(sectorWeightings)) {
      sectors = sectorWeightings.map((s: any) => {
        // s is { sector: 'technology', weight: 0.23 }
        // we want percent
        // weight is usually decimal
        const w = (Object.values(s)[0] as number) * 100;
        const n = Object.keys(s)[0];
        // Wait, structure is usually { sectorName: weight }?
        // No, verify structure.
        // Yahoo API usually returns array of objects like:
        // [ { real_estate: 0.02 }, { consumer_cyclical: 0.1 } ]
        // So we need to parse keys.
        return {
           sector_name: formatSectorName(n),
           weight: w
        };
      });
    } else if (assetType === 'STOCK' && assetProfile?.sector) {
      sectors.push({ sector_name: assetProfile.sector, weight: 100.0 });
    }

    // Dividends
    // `yahooFinance.historical(ticker, { events: 'dividends' })`
    // We want last 2 years.
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const period1 = twoYearsAgo.toISOString().split('T')[0];

    const divEvents = await yahooFinance.historical(tickerSymbol, {
      period1,
      events: 'dividends',
      interval: '1d' // Interval doesn't matter much for events only?
    });
    // divEvents returns array of prices if events not specified?
    // With events: 'dividends', it returns only dividends?
    // Actually `historical` returns mixed if not careful, but usually dividends are separate query or filtered.
    // Docs: `events` option filters.
    // "If events is specified, returns an array of objects { date, amount } (dividends) or { date, splitRatio } (splits)."

    const dividendHistory = divEvents
      .filter((e: any) => e.dividends !== undefined) // or just check structure
      .map((e: any) => ({
        date: e.date.toISOString(),
        amount: e.dividends
      }))
      // Sort desc
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


    // Allocation
    // Hard to get via API directly cleanly.
    // Use fallback logic.
    let allocStocks = 100.0;
    let allocBonds = 0.0;
    let allocCash = 0.0;

    // Try to guess from category or fundProfile?
    // For now stick to old logic or default.
    // Old logic used `category`.
    // `fundProfile` might have `categoryName`.
    // `summary.fundProfile?.categoryName`
    // `summary.defaultKeyStatistics?.category` ?
    // Let's check `quoteData` or summary for category.
    // `quoteData` doesn't have category usually.
    // `summary.fundProfile` has `categoryName`.

    const cat = (summary.fundProfile?.categoryName || "").toLowerCase();
    if (cat.includes("bond") || cat.includes("fixed income")) {
        allocStocks = 0.0;
        allocBonds = 100.0;
    }

    const allocation = {
        stocks_weight: allocStocks,
        bonds_weight: allocBonds,
        cash_weight: allocCash
    };

    // History
    // We need 1H, 1D, 1W, 1M intervals (tagged differently)
    // 1H: 5d, 60m
    // 1D: 1mo, 1d
    // 1WK: 2y, 1wk
    // 1MO: max, 1mo

    const historyPoints: any[] = [];

    const fetchHist = async (p: string, i: any, tag: string) => {
      try {
        const data = await yahooFinance.historical(tickerSymbol, { period1: getDateForPeriod(p), interval: i });
        return data.map((d: any) => ({
           date: d.date.toISOString(),
           close: d.close,
           interval: tag
        }));
      } catch (e) {
        return [];
      }
    };

    // We can run these in parallel
    const [h1, h1d, h1w, h1m] = await Promise.all([
      fetchHist('5d', '60m', '1h'),
      fetchHist('1mo', '1d', '1d'),
      fetchHist('2y', '1wk', '1wk'),
      fetchHist('max', '1mo', '1mo')
    ]);

    historyPoints.push(...h1, ...h1d, ...h1w, ...h1m);

    return {
      ticker: tickerSymbol,
      name,
      currency,
      exchange,
      price: priceMod.regularMarketPrice || 0,
      daily_change: quoteData.regularMarketChangePercent || 0, // Use quote data for consistency
      yield: yieldVal,
      mer,
      asset_type: assetType,
      history: historyPoints,
      dividendHistory,
      sectors,
      allocation
    };

  } catch (e) {
    console.error(`Error fetching details for ${tickerSymbol}:`, e);
    return null;
  }
};

function formatSectorName(key: string): string {
    // e.g. "real_estate" -> "Real Estate"
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getDateForPeriod(period: string): string {
  // yahoo-finance2 `historical` uses `period1` (start date).
  // `period` strings like '5d' are not directly supported in `historical` (v2),
  // they are supported in `chart` module but `historical` is safer/standard.
  // Wait, `historical` takes `period1` as date or string.
  // Docs say: "period1: required. Date, string, or number."
  // It does NOT support "5d" string as period length.
  // We must calculate the start date.

  const d = new Date();
  if (period === '5d') d.setDate(d.getDate() - 5);
  else if (period === '1mo') d.setMonth(d.getMonth() - 1);
  else if (period === '2y') d.setFullYear(d.getFullYear() - 2);
  else if (period === 'max') return '1900-01-01'; // Far past

  return d.toISOString().split('T')[0];
}
