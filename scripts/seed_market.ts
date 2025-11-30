import 'dotenv/config';
import { PrismaClient } from '../lib/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { execFile } from 'child_process';
import path from 'path';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const POPULAR_ETFS = [
  'VFV', 'XEQT', 'SPY', 'QQQ', 'VOO', 'XIU', 'ZEB', 'VGRO', 'XGRO', 'VEQT',
  'VUN', 'HQU', 'HOU', 'XIC', 'VDY', 'ZSP', 'XIU.TO', 'VFV.TO', 'XEQT.TO',
  'ZEB.TO', 'XIU.TO', 'VGRO.TO', 'XGRO.TO', 'VEQT.TO'
  // Added .TO for some common ones to ensure they are found if yfinance expects it
  // But generally, the user input list had "VFV, XEQT" which often imply .TO in Canada context
  // or US ones. I will include a mix or rely on the python script to just try.
  // The python script `fetch_market_snapshot.py` I wrote doesn't auto-append .TO.
  // I should probably be explicit here.
];

// Refined list with explicit suffixes for Canadian ETFs where common
// Assuming US tickers for SPY, QQQ, VOO.
// Canadian for VFV, XEQT, XIU, ZEB.
const TARGET_TICKERS = [
  'SPY', 'QQQ', 'VOO', 'IVV', 'VTI', // US
  'VFV.TO', 'XEQT.TO', 'XIU.TO', 'ZEB.TO', 'VGRO.TO', 'XGRO.TO', 'VEQT.TO', // CA
  'VUN.TO', 'XIC.TO', 'VDY.TO', 'ZSP.TO', 'HQU.TO', 'HOU.TO'
];

async function seedMarket() {
  console.log('🌱 Starting Fast Seed...');

  const pythonScript = path.join(process.cwd(), 'scripts', 'fetch_market_snapshot.py');

  // 1. Get existing tickers from DB to ensure we update everything (including user searches like BABA)
  const existingEtfs = await prisma.etf.findMany({
    select: { ticker: true }
  });
  const existingTickers = existingEtfs.map(e => e.ticker);

  // 2. Merge with TARGET_TICKERS and deduplicate
  const allTickers = Array.from(new Set([...TARGET_TICKERS, ...existingTickers]));

  // Join tickers with commas
  const tickersArg = allTickers.join(',');

  console.log(`fetching data for ${allTickers.length} tickers: ${tickersArg}`);

  try {
    const result = await new Promise<string>((resolve, reject) => {
      execFile('python3', [pythonScript, tickersArg], (error, stdout, stderr) => {
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

    const data = JSON.parse(result);
    console.log(`Received ${data.length} ETF snapshots.`);

    for (const item of data) {
      await prisma.etf.upsert({
        where: { ticker: item.ticker },
        update: {
          name: item.name,
          price: item.price,
          daily_change: item.daily_change,
          assetType: item.asset_type, // <--- ADD THIS to update existing records
          isDeepAnalysisLoaded: false,
        },
        create: {
          ticker: item.ticker,
          name: item.name,
          currency: 'USD',
          price: item.price,
          daily_change: item.daily_change,
          assetType: item.asset_type || "ETF", // <--- ADD THIS to create correctly
          isDeepAnalysisLoaded: false,
        },
      });
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
