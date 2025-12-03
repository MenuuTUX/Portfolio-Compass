import prisma from '../lib/db';

async function main() {
    console.log('Clearing database...');

    try {
        await prisma.etfHistory.deleteMany({});
        console.log('Deleted EtfHistory');
        await prisma.etfSector.deleteMany({});
        console.log('Deleted EtfSector');
        await prisma.etfAllocation.deleteMany({});
        console.log('Deleted EtfAllocation');
        await prisma.portfolioItem.deleteMany({});
        console.log('Deleted PortfolioItem');
        await prisma.etf.deleteMany({});
        console.log('Deleted Etf');
        console.log('Database cleared successfully.');
    } catch (error: any) {
        console.error('Error clearing database:', error);
        await Bun.write('error.log', JSON.stringify(error, null, 2) + '\n' + error.toString());
        process.exit(1);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
