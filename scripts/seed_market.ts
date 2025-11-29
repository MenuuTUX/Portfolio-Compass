import { PrismaClient } from '../lib/generated/prisma';
import { execFile } from 'child_process';
import path from 'path';

const prisma = new PrismaClient();

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

  // Join tickers with commas
  const tickersArg = TARGET_TICKERS.join(',');

  console.log(`fetching data for: ${tickersArg}`);

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
          // Don't overwrite isDeepAnalysisLoaded if it's already true?
          // The prompt says: "Write these to the Etf table with isDeepAnalysisLoaded = false."
          // But if we already have deep analysis, maybe we shouldn't reset it?
          // "Goal: Pre-populate... so search is instant."
          // If I reset it, they have to fetch details again.
          // I will default it to false if creating, but maybe keep it if updating?
          // The prompt says "Write these ... with isDeepAnalysisLoaded = false".
          // I will follow instructions strictly for new ones, but for existing?
          // "Replaces the old fetch_prices.py for initialization."
          // If I run this, I likely want to refresh prices.
          // If I set isDeepAnalysisLoaded = false, I invalidate the cache.
          // That might be intended to force a refresh of details if they are old?
          // But let's assume if we only fetch price, we don't have the deep data in THIS payload.
          // So strictly speaking, we don't have deep analysis *in this update*.
          // However, we might still have the history in DB.
          // I'll keep `isDeepAnalysisLoaded` as is if it exists, or false if new.
          // Wait, user says: "Write these to the Etf table with isDeepAnalysisLoaded = false."
          // I will follow this. It implies invalidating or setting initial state.
          // However, to be safe for "Instant Search" without breaking existing "Advanced View" immediately,
          // I will only set it to false if I am creating. If updating, I should arguably leave it alone
          // UNLESS the strategy is "Light seed resets everything".
          // Let's assume this is for "Initialization" (Seed).
          // I'll set it to false to be safe as per prompt.
           isDeepAnalysisLoaded: false,
        },
        create: {
          ticker: item.ticker,
          name: item.name,
          currency: 'USD', // Default, fixed later by deep fetch
          price: item.price,
          daily_change: item.daily_change,
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
