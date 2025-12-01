import 'dotenv/config';
import { PrismaClient } from '../lib/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { execFile } from 'child_process';
import path from 'path';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runPythonScript(scriptPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('python3', [scriptPath, ...args], { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`Python stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

async function seedMarket() {
  console.log('🌱 Starting Comprehensive Market Seed...');

  const pythonScript = path.join(process.cwd(), 'scripts', 'fetch_market_snapshot.py');

  try {
    // 1. Get Target Tickers (S&P 500 + Top ETFs)
    console.log('Fetching target ticker list...');
    const tickersJson = await runPythonScript(pythonScript, ['--get-tickers']);
    const targetTickers: string[] = JSON.parse(tickersJson);
    console.log(`Found ${targetTickers.length} target tickers.`);

    // 2. Get existing tickers from DB to ensure we update everything
    const existingEtfs = await prisma.etf.findMany({
      select: { ticker: true }
    });
    const existingTickers = existingEtfs.map(e => e.ticker);

    // 3. Merge and deduplicate
    const allTickers = Array.from(new Set([...targetTickers, ...existingTickers]));
    console.log(`Total unique tickers to process: ${allTickers.length}`);

    // 4. Process in chunks to avoid command line length limits or timeouts
    const CHUNK_SIZE = 50;
    for (let i = 0; i < allTickers.length; i += CHUNK_SIZE) {
      const chunk = allTickers.slice(i, i + CHUNK_SIZE);
      const tickersArg = chunk.join(',');

      console.log(`Processing chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(allTickers.length / CHUNK_SIZE)} (${chunk.length} tickers)...`);

      try {
        const result = await runPythonScript(pythonScript, [tickersArg]);
        const data = JSON.parse(result);

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
