import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { syncEtfDetails } from "@/lib/etf-sync";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes timeout

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Authorization check
    // Vercel Cron sends the `Authorization` header automatically if `CRON_SECRET` is configured.
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");

    // 1. Fail securely if the secret is not configured in the environment at all.
    // This prevents the endpoint from "failing open" (becoming public) if the env var is missing.
    if (!cronSecret) {
      // In development, we might allow bypass for testing convenience, but warn loudly.
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[Batch Sync] WARNING: CRON_SECRET is not set. Allowing access for local development.",
        );
      } else {
        console.error(
          "[Batch Sync] CRITICAL: CRON_SECRET is not set in production. Access denied.",
        );
        return NextResponse.json(
          { error: "Server Configuration Error: Missing CRON_SECRET" },
          { status: 500 },
        );
      }
    }
    // 2. If configured, strictly enforce the Bearer token match.
    else {
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const token = authHeader.split(" ")[1];

      // Use timingSafeEqual to prevent timing attacks
      const secretBuffer = Buffer.from(cronSecret);
      const tokenBuffer = Buffer.from(token);

      if (
        secretBuffer.length !== tokenBuffer.length ||
        !crypto.timingSafeEqual(secretBuffer, tokenBuffer)
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 1. Get 5 oldest records
    const batchEtfs = await prisma.etf.findMany({
      select: { ticker: true },
      orderBy: { updatedAt: "asc" },
      take: 5,
    });

    if (batchEtfs.length === 0) {
      return NextResponse.json({ message: "No ETFs to sync", results: [] });
    }

    console.log(`Starting batch sync for ${batchEtfs.length} ETFs...`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // 2. Sync each one
    for (const etf of batchEtfs) {
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
      message: `Batch sync complete. Success: ${successCount}, Failed: ${failureCount}`,
      results,
    });
  } catch (error) {
    console.error("Error in batch sync:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
