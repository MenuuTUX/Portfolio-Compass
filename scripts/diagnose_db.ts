
import prisma from '../lib/db';

async function diagnose() {
    console.log("--- Starting Database Diagnosis ---");

    try {
        console.log("1. Testing Connection...");
        await prisma.$connect();
        console.log("   [SUCCESS] Connected to Database.");
    } catch (e) {
        console.error("   [FAILED] Could not connect to Database.");
        console.error(e);
        return;
    }

    try {
        console.log("2. Checking ETF Count...");
        const count = await prisma.etf.count();
        console.log(`   [SUCCESS] ETF Count: ${count}`);
    } catch (e) {
        console.error("   [FAILED] Could not count ETFs.");
        console.error(e);
    }

    try {
        console.log("3. Testing 'redditUrl' Column Existence...");

        // Try to create/upsert a dummy record to verify write capability and schema
        // This is a safer test than just select if the table is empty
        const dummy = await prisma.etf.upsert({
            where: { ticker: 'TEST_DIAGNOSTIC' },
            update: { redditUrl: 'http://test.com' },
            create: {
                ticker: 'TEST_DIAGNOSTIC',
                name: 'Test Diagnostic',
                price: '100',
                daily_change: '0',
                redditUrl: 'http://test.com',
                currency: 'USD',
                assetType: 'ETF'
            }
        });

        console.log("   [SUCCESS] Upserted 'redditUrl' successfully.", dummy.redditUrl);

        // Clean up
        await prisma.etf.delete({ where: { ticker: 'TEST_DIAGNOSTIC' } });

    } catch (e) {
        console.error("   [FAILED] Query with 'redditUrl' failed. Schema might not be applied.");
        console.error(e);
    }

    console.log("--- Diagnosis Complete ---");
}

diagnose()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
