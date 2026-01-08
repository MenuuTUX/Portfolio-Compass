import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncEtfDetails } from "@/lib/etf-sync";
import { fetchMarketSnapshot } from "@/lib/market-service";
import pLimit from "p-limit";
import { Prisma } from "@prisma/client";
import { isValidTicker } from "@/lib/validators";

export const dynamic = "force-dynamic";

// Limit concurrent DB writes to avoid connection pool exhaustion
const limit = pLimit(1);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toUpperCase().trim() || "";
    const tickersParam = searchParams.get("tickers");
    const fullDetails = searchParams.get("full") === "true";
    const includeHoldings = searchParams.get("includeHoldings") === "true";
    const includeHistory = searchParams.get("includeHistory") === "true";
    const type = searchParams.get("type"); // 'ETF' | 'STOCK' | undefined

    // 1. Handle Bulk Fetch (via 'tickers' param)
    if (tickersParam) {
      const tickers = tickersParam
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => isValidTicker(t))
        .slice(0, 50); // Hard limit to prevent DoS

      if (tickers.length === 0) {
        return NextResponse.json([]);
      }

      // Fetch existing from DB
      const existingEtfs = await prisma.etf.findMany({
        where: { ticker: { in: tickers } },
        include: {
          sectors: true, // Always include basic sector data if available
          // Conditionally include other relations based on request
          holdings: fullDetails || includeHoldings,
          history: fullDetails || includeHistory
            ? {
                orderBy: { date: "asc" },
                // If fullDetails is false but history requested (e.g. sparklines),
                // we could limit history, but for now we fetch all and slice in frontend or here.
                // Optimizing: If we only need sparkline, we might want fewer points,
                // but the 'interval' logic is handled in sync.
              }
            : false,
        },
      });

      // Identify missing
      const existingTickers = new Set(existingEtfs.map((e) => e.ticker));
      const missingTickers = tickers.filter((t) => !existingTickers.has(t));

      // Fetch missing from Market Service
      if (missingTickers.length > 0) {
        // We use fetchMarketSnapshot for efficient bulk quote retrieval
        const snapshots = await fetchMarketSnapshot(missingTickers);

        // Seed missing into DB in background (fire and forget or await if critical?)
        // For search response speed, we might return the snapshot data formatted as ETF
        // and trigger a background sync.
        // However, to ensure they exist for subsequent calls, we'll do a quick upsert here.

        const newEtfs = await Promise.all(
          snapshots.map((snap) =>
            limit(async () => {
              // Basic seed
              try {
                // Upsert to handle race conditions
                return await prisma.etf.upsert({
                  where: { ticker: snap.symbol },
                  create: {
                    ticker: snap.symbol,
                    name: snap.shortName || snap.symbol,
                    price: snap.regularMarketPrice,
                    currency: snap.currency || "CAD",
                    daily_change: snap.regularMarketChangePercent,
                    updatedAt: new Date(),
                    assetType: snap.quoteType === "ETF" ? "ETF" : "STOCK", // Simple inference
                  },
                  update: {
                    // Update price if it exists
                    price: snap.regularMarketPrice,
                    daily_change: snap.regularMarketChangePercent,
                    updatedAt: new Date(),
                  },
                  include: {
                    sectors: true,
                    holdings: fullDetails || includeHoldings,
                    history: fullDetails || includeHistory
                      ? { orderBy: { date: "asc" } }
                      : false,
                  },
                });
              } catch (e) {
                console.error(`Failed to seed ${snap.symbol}`, e);
                return null;
              }
            }),
          ),
        );

        // Combine
        const validNewEtfs = newEtfs.filter(
          (e) => e !== null,
        ) as typeof existingEtfs;
        const allEtfs = [...existingEtfs, ...validNewEtfs];

        // Trigger background full sync for these new items if they are skeletons
        // (Not blocking the response)
        // Note: In serverless, background tasks after response are tricky.
        // We rely on the client or Cron to fill in deep details later.
        // OR if 'full' is requested, we might forcedly sync one.

        return NextResponse.json(
          allEtfs.map((e) => ({
            ...e,
            price: e.price.toNumber(),
            dailyChange: e.daily_change.toNumber(),
            yield: e.yield ? e.yield.toNumber() : undefined,
            mer: e.mer ? e.mer.toNumber() : undefined,
            sectors: e.sectors?.map((s) => ({
              name: s.sector,
              value: s.weight.toNumber(),
            })),
            holdings: e.holdings?.map((h) => ({
              ticker: h.ticker,
              name: h.name,
              weight: h.weight.toNumber(),
            })),
            history: e.history?.map((h) => ({
              date: h.date.toISOString().split("T")[0],
              price: h.price.toNumber(),
            })),
          })),
        );
      }

      return NextResponse.json(
        existingEtfs.map((e) => ({
          ...e,
          price: e.price.toNumber(),
          dailyChange: e.daily_change.toNumber(),
          yield: e.yield ? e.yield.toNumber() : undefined,
          mer: e.mer ? e.mer.toNumber() : undefined,
          sectors: e.sectors?.map((s) => ({
            name: s.sector,
            value: s.weight.toNumber(),
          })),
          holdings: e.holdings?.map((h) => ({
            ticker: h.ticker,
            name: h.name,
            weight: h.weight.toNumber(),
          })),
          history: e.history?.map((h) => ({
            date: h.date.toISOString().split("T")[0],
            price: h.price.toNumber(),
          })),
        })),
      );
    }

    // 2. Handle Single Item Full Detail Request
    if (fullDetails && query && isValidTicker(query)) {
      let etf = await prisma.etf.findUnique({
        where: { ticker: query },
        include: {
          sectors: true,
          holdings: {
            orderBy: { weight: "desc" },
            take: 100, // Reasonable limit
          },
          history: {
            orderBy: { date: "asc" },
            where: {
               // If requesting full history, we might want to filter interval
               // Usually '1d' is standard.
               interval: '1d' // Ensure we get daily candles
            }
          },
        },
      });

      const isStale =
        !etf ||
        Date.now() - etf.updatedAt.getTime() > 1000 * 60 * 60 * 24; // 24 hours
      // Also check if we have deep data (like holdings/sectors) which might be missing on initial seed
      const isMissingDeepData =
        etf &&
        (etf.assetType === "ETF" &&
          (etf.sectors.length === 0 || etf.holdings.length === 0));

      if (!etf || isStale || isMissingDeepData) {
        // Perform blocking sync for detail view to ensure user gets data
        try {
           // If it's a new ticker, this might take a few seconds
           await syncEtfDetails(query, true, true);
           // Re-fetch
           etf = await prisma.etf.findUnique({
            where: { ticker: query },
            include: {
              sectors: true,
              holdings: {
                orderBy: { weight: "desc" },
                take: 100,
              },
              history: {
                orderBy: { date: "asc" },
                where: { interval: '1d' }
              },
            },
          });
        } catch(e) {
           console.error(`Failed to sync details for ${query}`, e);
           // If sync fails but we have stale data, return it?
           if (!etf) {
             return NextResponse.json({ error: "Asset not found" }, { status: 404 });
           }
        }
      }

      if (!etf) return NextResponse.json({ error: "Not found" }, { status: 404 });

      // Transform for frontend
      return NextResponse.json({
        ...etf,
        price: etf.price.toNumber(),
        dailyChange: etf.daily_change.toNumber(),
        yield: etf.yield?.toNumber(),
        mer: etf.mer?.toNumber(),
        marketCap: etf.marketCap?.toNumber(),
        beta: etf.beta5Y?.toNumber(),
        pe: etf.peRatio?.toNumber(),
        eps: etf.eps?.toNumber(),
        dividend: etf.dividend?.toNumber(),
        sharesOutstanding: etf.sharesOut?.toNumber(),
        revenue: etf.revenue?.toNumber(),
        sectors: etf.sectors.map((s) => ({
          name: s.sector,
          value: s.weight.toNumber(),
        })),
        holdings: etf.holdings.map((h) => ({
          ticker: h.ticker,
          name: h.name,
          weight: h.weight.toNumber(),
          shares: h.shares ? h.shares.toNumber() : undefined,
          sector: h.sector
        })),
        history: etf.history.map((h) => ({
          date: h.date.toISOString().split("T")[0],
          price: h.price.toNumber(),
        })),
      });
    }

    // 3. Handle General Text Search
    const where: Prisma.EtfWhereInput = {
      OR: [
        { ticker: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ],
    };

    if (type) {
        where.assetType = type;
    }

    const results = await prisma.etf.findMany({
      where,
      take: 10,
      orderBy: {
        marketCap: 'desc', // Prioritize larger assets
      },
      include: {
        sectors: true,
      }
    });

    const formattedEtfs = results.map((etf) => ({
      ticker: etf.ticker,
      name: etf.name,
      price: etf.price.toNumber(),
      currency: etf.currency,
      dailyChange: etf.daily_change.toNumber(),
      yield: etf.yield?.toNumber(),
      assetType: etf.assetType,
      sectors: etf.sectors.map((s) => ({
        name: s.sector,
        value: s.weight.toNumber(),
      })),
    }));

    return NextResponse.json(formattedEtfs);
  } catch (error) {
    console.error("[API] Error searching ETFs:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
