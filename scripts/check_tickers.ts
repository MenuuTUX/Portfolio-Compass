import prisma from '../lib/db';

async function checkTickers() {
  console.log('🔍 Checking Tickers...');

  try {
    const etfCount = await prisma.etf.count();
    console.log(`Total ETFs/Stocks in DB: ${etfCount}`);

    const etfs = await prisma.etf.findMany({
      take: 10,
      orderBy: { updatedAt: 'desc' }
    });

    console.log('Most recently updated tickers:');
    etfs.forEach(e => {
      console.log(`- ${e.ticker}: $${e.price} (${e.daily_change}%) [${e.assetType}]`);
    });

  } catch (error) {
    console.error('❌ Error checking tickers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTickers();
