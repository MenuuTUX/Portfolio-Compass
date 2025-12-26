import prisma from '../lib/db';
import { fetchMarketSnapshot } from '../lib/market-service';

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
    console.error('Error fetching S&P 500 tickers:', e);
    return ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA'];
  }
}

function getTopETFs(): string[] {
  return [
    'SPY', 'IVV', 'VOO', 'VTI', 'QQQ', 'VEA', 'VTV', 'IEFA', 'BND', 'AGG',
    'VUG', 'VIG', 'IJR', 'IWF', 'VWO', 'IJH', 'VGT', 'XLK', 'IWM', 'GLD',
    'XIU.TO', 'XIC.TO', 'VFV.TO', 'VUN.TO', 'XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO',
    'ZEB.TO', 'VDY.TO', 'ZSP.TO', 'HQU.TO', 'HOU.TO', 'HOD.TO', 'HNU.TO',
    'ZAG.TO', 'XBB.TO', 'VAB.TO', 'XSP.TO',
    'XLV', 'XLF', 'XLY', 'XLP', 'XLE', 'XLI', 'XLB', 'XLRE', 'XLU', 'SMH',
    // Additional ETFs
    'SCHD', 'JEPI', 'JEPQ', 'DIA', 'IWD', 'IWB', 'MDY', 'RSP', 'VYM', 'DVY',
    'USMV', 'QUAL', 'MTUM', 'VLUE', 'SIZE', 'SPLG', 'SPYG', 'SPYD', 'SCHG', 'SCHX',
    'SCHB', 'SCHA', 'ITOT', 'IXUS', 'ACWI', 'VT', 'BNDX', 'MUB', 'TIP', 'LQD',
    'HYG', 'JNK', 'PFF', 'PGX', 'VNQ', 'REM', 'INDA', 'MCHI', 'EWJ', 'EWZ'
  ];
}

function getMag7Tickers(): string[] {
  return ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
}

function getJustBuyTickers(): string[] {
  return ['XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO', 'VFV.TO', 'VUN.TO', 'ZEB.TO'];
}


async function seedMarket() {
  console.log('🌱 Starting Comprehensive Market Seed...');

  try {
    console.log('Fetching target ticker list...');

    const [sp500, topEtfs, mag7, justBuy] = await Promise.all([
      getSP500Tickers(),
      Promise.resolve(getTopETFs()),
      Promise.resolve(getMag7Tickers()),
      Promise.resolve(getJustBuyTickers())
    ]);

    const targetTickers = Array.from(new Set([...sp500, ...topEtfs, ...mag7, ...justBuy]));
    console.log(`Found ${targetTickers.length} target tickers.`);

    const existingEtfs = await prisma.etf.findMany({
      select: { ticker: true }
    });
    const existingTickers = existingEtfs.map(e => e.ticker);

    const allTickers = Array.from(new Set([...targetTickers, ...existingTickers]));
    console.log(`Total unique tickers to process: ${allTickers.length}`);

    const CHUNK_SIZE = 50;
    for (let i = 0; i < allTickers.length; i += CHUNK_SIZE) {
      const chunk = allTickers.slice(i, i + CHUNK_SIZE);
      console.log(`Processing chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(allTickers.length / CHUNK_SIZE)} (${chunk.length} tickers)...`);

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
        console.error(`Error processing chunk starting at index ${i}:`, err);
      }
    }
    console.log('✅ Market Seeded Successfully.');
  } catch (error) {
    console.error('❌ Error Seeding Market:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedMarket();
