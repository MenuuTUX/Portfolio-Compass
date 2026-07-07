// Connectivity check: one read against the configured database.
// Run with: bun run scripts/verify-prisma.ts
import prisma from "../lib/db";

async function main() {
  const etfCount = await prisma.etf.count();
  const sample = await prisma.etf.findFirst({
    select: { ticker: true, name: true, price: true },
    orderBy: { updatedAt: "desc" },
  });

  console.log("✅ Connected");
  console.log(`   Etf rows: ${etfCount}`);
  if (sample) {
    console.log(
      `   Latest: ${sample.ticker} (${sample.name}) @ ${sample.price}`,
    );
  } else {
    console.log("   Table is empty — run `bunx prisma db seed` to populate.");
  }
}

main()
  .catch((err) => {
    console.error("❌ Connection failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
