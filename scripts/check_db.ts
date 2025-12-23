import prisma from '../lib/db';

async function main() {
  try {
    console.log('Connecting to database...');
    const count = await prisma.etf.count();
    console.log(`Successfully connected. Found ${count} ETFs in the database.`);

    if (count > 0) {
      const firstEtf = await prisma.etf.findFirst();
      console.log('First ETF:', firstEtf?.ticker, firstEtf?.name);
    }
  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
