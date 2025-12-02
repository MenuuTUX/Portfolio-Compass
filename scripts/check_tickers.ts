import 'dotenv/config';
import { PrismaClient } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function checkTickers() {
    const tickersToCheck = ['XEQT.TO', 'VEQT.TO', 'AAPL', 'MSFT'];
    const found = await prisma.etf.findMany({
        where: {
            ticker: { in: tickersToCheck }
        }
    });

    console.log('Found tickers:', found.map(f => f.ticker));
    await prisma.$disconnect();
}

checkTickers();
