import 'dotenv/config';
import { PrismaClient } from '../lib/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
