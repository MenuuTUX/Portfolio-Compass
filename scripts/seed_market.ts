import prisma from '../lib/db';
import { fetchMarketSnapshot } from '../lib/market-service';
import { TOP_ETFS, MAG7_TICKERS, JUST_BUY_TICKERS, SP500_FALLBACK } from '../config/tickers';

async function getSP500Tickers(): Promise<string[]> {
  try {
    const response = await fetch('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies');
    const html = await response.text();
    const regex = /<a rel="nofollow" class="external text" href="[^"]+">([A-Z0-9\.]+)<\/a>/g;
    const matches = [...html.matchAll(regex)];
    let tickers = matches.map(m => m[1]);
    tickers = tickers.map(t => t.replace(/\./g, '-'));
    return Array.from(new Set(tickers));
  } catch (e) {
    console.error('[Seed] Failed to fetch S&P 500 tickers, using fallback:', e);
    return SP500_FALLBACK;
  }
}

async function seedMarket() {
  console.log('[Seed] Starting Market Seed...');

  try {
    const [sp500] = await Promise.all([
      getSP500Tickers()
    ]);

    const targetTickers = Array.from(new Set([...sp500, ...TOP_ETFS, ...MAG7_TICKERS, ...JUST_BUY_TICKERS]));
    console.log(`[Seed] Target tickers: ${targetTickers.length}`);

    const existingEtfs = await prisma.etf.findMany({
      select: { ticker: true }
    });
    const existingTickers = existingEtfs.map(e => e.ticker);

    const allTickers = Array.from(new Set([...targetTickers, ...existingTickers]));
    console.log(`[Seed] Total unique tickers: ${allTickers.length}`);

    const CHUNK_SIZE = 50;
    for (let i = 0; i < allTickers.length; i += CHUNK_SIZE) {
      const chunk = allTickers.slice(i, i + CHUNK_SIZE);
      console.log(`[Seed] Processing chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(allTickers.length / CHUNK_SIZE)}`);

      try {
        const data = await fetchMarketSnapshot(chunk);
        for (const item of data) {
            await prisma.etf.upsert({
                where: { ticker: item.ticker },
                update: {
                  name: item.name,
                  price: item.price,
                  daily_change: item.dailyChangePercent,
                  assetType: item.assetType,
                  isDeepAnalysisLoaded: false,
                },
                create: {
                  ticker: item.ticker,
                  name: item.name,
                  currency: 'USD',
                  price: item.price,
                  daily_change: item.dailyChangePercent,
                  assetType: item.assetType || "ETF",
                  yield: 0,
                  mer: 0,
                  isDeepAnalysisLoaded: false,
                },
              });
        }
      } catch (err) {
        console.error(`[Seed] Error processing chunk ${i}:`, err);
      }
    }
    console.log('[Seed] Market Seed Completed.');
  } catch (error) {
    console.error('[Seed] Fatal Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedMarket();
