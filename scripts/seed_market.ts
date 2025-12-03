import 'dotenv/config';
import { PrismaClient } from '../lib/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import {
  getSP500Tickers,
  getTopETFs,
  getMag7Tickers,
  getJustBuyTickers,
  fetchMarketSnapshot
} from '../lib/yahoo-client';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedMarket() {
  console.log('🌱 Starting Comprehensive Market Seed...');

  try {
    // 1. Get Target Tickers (S&P 500 + Top ETFs)
    console.log('Fetching target ticker list...');

    // Run concurrently
    const [sp500, topEtfs, mag7, justBuy] = await Promise.all([
      getSP500Tickers(),
      Promise.resolve(getTopETFs()),
      Promise.resolve(getMag7Tickers()),
      Promise.resolve(getJustBuyTickers())
    ]);

    const targetTickers = Array.from(new Set([...sp500, ...topEtfs, ...mag7, ...justBuy]));
    console.log(`Found ${targetTickers.length} target tickers.`);

    // 2. Get existing tickers from DB to ensure we update everything
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
          await prisma.etf.upsert({
            where: { ticker: item.ticker },
            update: {
              name: item.name,
              price: item.price,
              daily_change: item.daily_change,
              assetType: item.asset_type,
              yield: item.yield,
              mer: item.mer,
              isDeepAnalysisLoaded: false,
            },
            create: {
              ticker: item.ticker,
              name: item.name,
              currency: 'USD',
              price: item.price,
              daily_change: item.daily_change,
              assetType: item.asset_type || "ETF",
              yield: item.yield,
              mer: item.mer,
              isDeepAnalysisLoaded: false,
            },
          });
        }
      } catch (err) {
        console.error(`Error processing chunk starting at index ${i}:`, err);
        // Continue to next chunk
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
