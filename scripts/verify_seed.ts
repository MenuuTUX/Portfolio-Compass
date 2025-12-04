import 'dotenv/config';
import prisma from '../lib/db';

async function verify() {
    try {
        const count = await prisma.etf.count();
        console.log(`Total ETFs/Stocks in DB: ${count}`);

        const sample = await prisma.etf.findFirst({
            where: { ticker: 'AAPL' }
        });
        console.log('Sample (AAPL):', sample);

        const etfSample = await prisma.etf.findFirst({
            where: { ticker: 'SPY' }
        });
        console.log('Sample (SPY):', etfSample);

        const withYield = await prisma.etf.count({
            where: { yield: { not: null } }
        });
        console.log(`Items with Yield: ${withYield}`);

        const withMer = await prisma.etf.count({
            where: { mer: { not: null } }
        });
        console.log(`Items with MER: ${withMer}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
