import prisma from "@/lib/db";
import { MarketSnapshot, fetchMarketSnapshot } from "@/lib/market-service";
import { syncEtfDetails } from "@/lib/etf-sync";
import { Decimal } from "decimal.js";
import pLimit from "p-limit";
import { toPrismaDecimalRequired } from "@/lib/prisma-utils";

/**
 * Shared concurrency limiter for database upsert operations.
 * Limits concurrent DB writes to 3 to prevent "MaxClientsInSessionMode" errors
 * in serverless environments where connection pooling is limited.
 */
export const dbLimit = pLimit(3);

/**
 * Creates a minimal valid ETF object from a market snapshot.
 * Used as a fallback when database persistence fails, ensuring the UI
 * still receives live price data even if the DB is unreachable.
 *
 * @param item - The live market snapshot
 * @returns A transient ETF object adhering to the schema interface
 */
export function createFallbackEtf(item: MarketSnapshot) {
  return {
    ticker: item.ticker,
    name: item.name,
    price: item.price,
    daily_change: item.dailyChangePercent,
    assetType: item.assetType || "ETF",
    isDeepAnalysisLoaded: false,
    yield: new Decimal(0),
    mer: new Decimal(0),
    history: [],
    sectors: [],
    allocation: null,
    updatedAt: new Date(),
  };
}

/**
 * Persists market data to the database with a resilient fallback strategy.
 *
 * Architectural Decision:
 * If the database write fails (e.g. connection pool full), we log the warning
 * and return a transient object ("Fallback ETF") so the user request succeeds.
 * This prioritizes Availability over Consistency for read-heavy search operations.
 *
 * @param item - The market snapshot to upsert
 * @param includeObj - Prisma 'include' object for returning relations
 * @returns The persisted entity or a transient fallback object
 */
export async function upsertEtfWithFallback(
  item: MarketSnapshot,
  includeObj: any,
): Promise<any> {
  try {
    return await prisma.etf.upsert({
      where: { ticker: item.ticker },
      update: {
        price: toPrismaDecimalRequired(item.price),
        daily_change: toPrismaDecimalRequired(item.dailyChangePercent),
        name: item.name,
      },
      create: {
        ticker: item.ticker,
        name: item.name,
        price: toPrismaDecimalRequired(item.price),
        daily_change: toPrismaDecimalRequired(item.dailyChangePercent),
        currency: "USD",
        assetType: item.assetType || "ETF",
        isDeepAnalysisLoaded: false,
      },
      include: includeObj,
    });
  } catch (error: any) {
    const isDbBusy =
      error.toString().includes("MaxClientsInSessionMode") ||
      error.toString().includes("DriverAdapterError");
    if (isDbBusy) {
      console.warn(`[Sync Service] DB Busy for ${item.ticker}, using fallback.`);
    } else {
      console.error(`[Sync Service] Failed to upsert ${item.ticker}:`, error);
    }
    return createFallbackEtf(item);
  }
}

/**
 * Identifies and synchronizes stale ETF data in the background.
 *
 * Architectural Decision:
 * Uses a "Stale-While-Revalidate" pattern extended to background processing.
 * - If data is "stale" (older than 1 hour) or lacks deep analysis, we trigger a sync.
 * - For "full history" requests (e.g. Monte Carlo), the sync is blocking (awaited).
 * - For standard list requests, the sync is fire-and-forget (non-blocking) to maintain UI responsiveness.
 *
 * @param etfs - The array of ETF entities fetched from DB
 * @param isFullHistoryRequested - Whether the user requested full history (implies blocking sync)
 * @param includeHistory - Whether history was requested at all
 */
export async function processBackgroundSync(
  etfs: any[],
  isFullHistoryRequested: boolean,
  includeHistory: boolean,
): Promise<void> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const staleEtfs = etfs.filter((e: any) => {
    if (!e.isDeepAnalysisLoaded) return true;
    if (!e.updatedAt || e.updatedAt < oneHourAgo) return true;

    if (includeHistory) {
      if (!e.history || e.history.length === 0) return true;

      // Check for insufficient history depth
      if (isFullHistoryRequested) {
        const dailyCount = e.history.filter((h: any) => h.interval === "1d")
          .length;
        if (dailyCount < 200) return true; // Ensure enough data points for Monte Carlo
      }

      const lastHistoryDate = e.history[e.history.length - 1].date;
      if (new Date(lastHistoryDate) < twoDaysAgo) return true;

      if (isFullHistoryRequested) {
        const hasWeekly = e.history.some((h: any) => h.interval === "1wk");
        const hasMonthly = e.history.some((h: any) => h.interval === "1mo");
        if (!hasWeekly || !hasMonthly) return true;
      }
    }
    return false;
  });

  if (staleEtfs.length > 0) {
    const syncLimit = pLimit(1);
    const maxSyncItems = isFullHistoryRequested ? Math.min(staleEtfs.length, 10) : 2;
    const itemsToSync = staleEtfs.slice(0, maxSyncItems);

    if (isFullHistoryRequested) {
      // Blocking sync for full history requests
      await Promise.all(
        itemsToSync.map((staleEtf: any) =>
          syncLimit(async () => {
            try {
              const synced = await syncEtfDetails(staleEtf.ticker, [
                "1h",
                "1d",
                "1wk",
                "1mo",
              ]);
              if (synced) {
                const index = etfs.findIndex(
                  (e) => e.ticker === staleEtf.ticker,
                );
                if (index !== -1) {
                    // Update in place to reflect fresh data in the current response
                    Object.assign(etfs[index], synced);
                }
              }
            } catch (err) {
              console.error(`[Sync Service] Sync failed for ${staleEtf.ticker}:`, err);
            }
          }),
        ),
      );
    } else {
      // Non-blocking background sync
      Promise.all(
        itemsToSync.map((staleEtf: any) =>
          syncLimit(() =>
            syncEtfDetails(staleEtf.ticker, ["1d"]).catch((err) => {
              console.warn(`[Sync Service] Background sync failed for ${staleEtf.ticker}:`, err);
            }),
          ),
        ),
      );
    }
  }
}
