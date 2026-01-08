import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncEtfDetails } from "@/lib/etf-sync";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes timeout for bulk sync

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");

    if (!cronSecret) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[Bulk Sync] WARNING: CRON_SECRET is not set. Allowing access for local development.",
        );
      } else {
        console.error(
          "[Bulk Sync] CRITICAL: CRON_SECRET is not set in production. Access denied.",
        );
        return NextResponse.json(
          { error: "Server Configuration Error: Missing CRON_SECRET" },
          { status: 500 },
        );
      }
    } else {
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const token = authHeader.split(" ")[1];
      const secretBuffer = Buffer.from(cronSecret);
      const tokenBuffer = Buffer.from(token);

      if (
        secretBuffer.length !== tokenBuffer.length ||
        !crypto.timingSafeEqual(secretBuffer, tokenBuffer)
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const allEtfs = await prisma.etf.findMany({
      select: { ticker: true },
    });

    if (allEtfs.length === 0) {
      return NextResponse.json({ message: "No ETFs to sync", results: [] });
    }

    console.log(`Starting bulk sync for ${allEtfs.length} ETFs...`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const etf of allEtfs) {
      try {
        await syncEtfDetails(etf.ticker);
        results.push({ ticker: etf.ticker, status: "success" });
        successCount++;
      } catch (error: any) {
        console.error(`Failed to sync ${etf.ticker}:`, error);
        results.push({
          ticker: etf.ticker,
          status: "error",
          error: error.message,
        });
        failureCount++;
      }
    }

    return NextResponse.json({
      message: `Sync complete. Success: ${successCount}, Failed: ${failureCount}`,
      results,
    });
  } catch (error) {
    console.error("Error in bulk sync:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
