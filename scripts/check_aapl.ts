
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.etf.count();
  console.log('Total ETFs:', count);

  const aapl = await prisma.etf.findUnique({
    where: { ticker: 'AAPL' }
  });
  console.log('AAPL:', aapl);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
