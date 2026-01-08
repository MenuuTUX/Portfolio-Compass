import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncEtfDetails } from "@/lib/etf-sync";
import { isMarketOpen } from "@/lib/market-hours";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    // Development mode bypass if needed, or strictly error out
  }
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV !== "development" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Check market status
  if (!isMarketOpen()) {
    console.log("Market is closed. Skipping sync.");
    return NextResponse.json({ skipped: true, reason: "Market Closed" });
  }

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const staleDefaultTickers = await prisma.etf.findMany({
      where: {
        ticker: { in: ["SPY", "QQQ", "VCOO", "VGRO.TO"] },
        updatedAt: { lt: oneHourAgo },
      },
      select: { ticker: true },
    });

    if (staleDefaultTickers.length > 0) {
      console.log(
        `Syncing stale defaults: ${staleDefaultTickers.map((t) => t.ticker).join(", ")}`,
      );
      for (const t of staleDefaultTickers) {
        try {
          // Pass intervals explicitly to optimize fetch
          await syncEtfDetails(t.ticker, true, false); // includeHistory=true
        } catch (e) {
          console.error(`Failed to sync default ${t.ticker}`, e);
        }
      }
      return NextResponse.json({
        success: true,
        synced: staleDefaultTickers.map((t) => t.ticker),
      });
    }

    const oldestEtf = await prisma.etf.findFirst({
      orderBy: { updatedAt: "asc" },
      select: { ticker: true },
    });

    if (oldestEtf) {
      console.log(`Incremental sync: ${oldestEtf.ticker}`);
      await syncEtfDetails(oldestEtf.ticker, true, false);
      return NextResponse.json({ success: true, synced: oldestEtf.ticker });
    }

    return NextResponse.json({ success: true, synced: null });
  } catch (error) {
    console.error("Cron sync failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
