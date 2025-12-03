import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
// Using standard client import since we are in a script context and standard generation usually works.
// Or use the one from `lib/db` if preferred but here we need direct client instantiation for script?
// The memory said "The Prisma Client is generated to `lib/generated/prisma` with `engineType = 'client'`".
// So maybe I should import from there? But the previous import `../lib/generated/prisma` failed.
// "Cannot find module '../lib/generated/prisma'".
// Let's check `prisma.config.ts` or schema to see output.
// But standard `@prisma/client` should work if generated correctly.
// Let's stick to `@prisma/client` if possible, or try relative path if I can find it.
// Wait, `lib/db.ts` uses `@prisma/client` usually? No, memory said generated to custom path.
// Let's assume `@prisma/client` points to the right place or I can just import from `@/lib/db`?
// Scripts run with `bun` so `@/` might not work unless configured in `tsconfig` which bun respects.
// Let's try importing `prisma` from `../lib/db` (relative).

import prisma from '../lib/db';
import { fetchMarketSnapshot } from '../lib/market-service';

// We need helper functions that were in yahoo-client.ts (getSP500Tickers, etc.)
// Since I deleted yahoo-client.ts, I need to implement them here or in market-service.
// They are specific to seeding/lists.
// I'll inline them here or move them to `lib/lists.ts`.
// For simplicity, I'll inline them or add to `market-service.ts`?
// The user didn't ask to preserve them, but seeding needs them.
// I will quickly reimplement them here.

async function getSP500Tickers(): Promise<string[]> {
  // Simplistic S&P 500 list or fetch from wiki
  // Replicating the logic from deleted file
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
    return ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA']; // Fallback
  }
}

function getTopETFs(): string[] {
  return [
    'SPY', 'IVV', 'VOO', 'VTI', 'QQQ', 'VEA', 'VTV', 'IEFA', 'BND', 'AGG',
    'VUG', 'VIG', 'IJR', 'IWF', 'VWO', 'IJH', 'VGT', 'XLK', 'IWM', 'GLD',
    'XIU.TO', 'XIC.TO', 'VFV.TO', 'VUN.TO', 'XEQT.TO', 'VEQT.TO', 'VGRO.TO', 'XGRO.TO',
    'ZEB.TO', 'VDY.TO', 'ZSP.TO', 'HQU.TO', 'HOU.TO', 'HOD.TO', 'HNU.TO',
    'ZAG.TO', 'XBB.TO', 'VAB.TO', 'XSP.TO',
    'XLV', 'XLF', 'XLY', 'XLP', 'XLE', 'XLI', 'XLB', 'XLRE', 'XLU', 'SMH'
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
    // 1. Get Target Tickers
    console.log('Fetching target ticker list...');

    const [sp500, topEtfs, mag7, justBuy] = await Promise.all([
      getSP500Tickers(),
      Promise.resolve(getTopETFs()),
      Promise.resolve(getMag7Tickers()),
      Promise.resolve(getJustBuyTickers())
    ]);

    const targetTickers = Array.from(new Set([...sp500, ...topEtfs, ...mag7, ...justBuy]));
    console.log(`Found ${targetTickers.length} target tickers.`);

    // 2. Get existing tickers from DB
    const existingEtfs = await prisma.etf.findMany({
      select: { ticker: true }
    });
    const existingTickers = existingEtfs.map(e => e.ticker);

    // 3. Merge and deduplicate
    const allTickers = Array.from(new Set([...targetTickers, ...existingTickers]));
    console.log(`Total unique tickers to process: ${allTickers.length}`);

    // 4. Process in chunks
    const CHUNK_SIZE = 50;
    for (let i = 0; i < allTickers.length; i += CHUNK_SIZE) {
      const chunk = allTickers.slice(i, i + CHUNK_SIZE);

      console.log(`Processing chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(allTickers.length / CHUNK_SIZE)} (${chunk.length} tickers)...`);

      try {
        const data = await fetchMarketSnapshot(chunk);

        for (const item of data) {
          // fetchMarketSnapshot returns { ticker, price, dailyChange, dailyChangePercent, name, assetType }
          // DB expects: daily_change (percent usually), yield, mer.
          // Snapshot doesn't return yield/mer anymore.
          // We can leave them as existing or 0.

          await prisma.etf.upsert({
            where: { ticker: item.ticker },
            update: {
              name: item.name,
              price: item.price,
              daily_change: item.dailyChangePercent, // Percent
              assetType: item.assetType,
              // yield/mer not updated by snapshot to save bandwidth/complexity in snapshot
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
    // pool end not needed as we use shared client
  }
}

seedMarket();
