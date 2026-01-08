import { prisma } from "@/lib/db";
import { fetchEtfDetails } from "@/lib/market-service";
import { Decimal } from "@/lib/decimal";
import { getAssetIconUrl } from "@/lib/etf-providers";

/**
 * Synchronizes a single ETF's details, holdings, sector allocation, and price history
 * with the database.
 */
export async function syncEtfDetails(
  ticker: string,
  includeHistory = false,
  isDeepSync = false,
) {
  const details = await fetchEtfDetails(ticker);

  if (!details) {
    throw new Error(`Could not fetch details for ${ticker}`);
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.etf.upsert({
        where: { ticker },
        update: {
          price: new Decimal(details.price || 0),
          currency: details.currency || "CAD",
          daily_change: new Decimal(details.dailyChange || 0),
          updatedAt: new Date(),
          yield: details.yield ? new Decimal(details.yield) : null,
          assetType: details.assetType || "ETF",
          name: details.name || ticker,
          description: details.description || undefined,
          logoUrl: details.assetType
            ? getAssetIconUrl(ticker, details.name || "", details.assetType)
            : undefined,
          marketCap: details.marketCap ? new Decimal(details.marketCap) : null,
          beta5Y: details.beta ? new Decimal(details.beta) : null,
          peRatio: details.pe ? new Decimal(details.pe) : null,
          eps: details.eps ? new Decimal(details.eps) : null,
          revenue: details.revenue ? new Decimal(details.revenue) : null,
          netIncome: details.netIncome
            ? new Decimal(details.netIncome)
            : null,
          sharesOut: details.sharesOut
            ? new Decimal(details.sharesOut)
            : null,
          dividend: details.dividend
            ? new Decimal(details.dividend)
            : null,
          expenseRatio: details.expenseRatio
            ? new Decimal(details.expenseRatio)
            : null,
          volume: details.volume ? new Decimal(details.volume) : null,
          openPrice: details.open ? new Decimal(details.open) : null,
          prevClose: details.prevClose
            ? new Decimal(details.prevClose)
            : null,
          fiftyTwoWeekHigh: details.fiftyTwoWeekHigh
            ? new Decimal(details.fiftyTwoWeekHigh)
            : null,
          fiftyTwoWeekLow: details.fiftyTwoWeekLow
            ? new Decimal(details.fiftyTwoWeekLow)
            : null,
          exDividendDate: details.exDividendDate
            ? new Date(details.exDividendDate)
            : null,
          earningsDate: details.earningsDate
            ? new Date(details.earningsDate)
            : null,
        },
        create: {
          ticker,
          name: details.name || ticker,
          price: new Decimal(details.price || 0),
          currency: details.currency || "CAD",
          daily_change: new Decimal(details.dailyChange || 0),
          updatedAt: new Date(),
          yield: details.yield ? new Decimal(details.yield) : null,
          assetType: details.assetType || "ETF",
          description: details.description || undefined,
          logoUrl: details.assetType
            ? getAssetIconUrl(ticker, details.name || "", details.assetType)
            : undefined,
          marketCap: details.marketCap ? new Decimal(details.marketCap) : null,
          beta5Y: details.beta ? new Decimal(details.beta) : null,
          peRatio: details.pe ? new Decimal(details.pe) : null,
          eps: details.eps ? new Decimal(details.eps) : null,
          revenue: details.revenue ? new Decimal(details.revenue) : null,
          netIncome: details.netIncome
            ? new Decimal(details.netIncome)
            : null,
          sharesOut: details.sharesOut
            ? new Decimal(details.sharesOut)
            : null,
          dividend: details.dividend
            ? new Decimal(details.dividend)
            : null,
          expenseRatio: details.expenseRatio
            ? new Decimal(details.expenseRatio)
            : null,
          volume: details.volume ? new Decimal(details.volume) : null,
          openPrice: details.open ? new Decimal(details.open) : null,
          prevClose: details.prevClose
            ? new Decimal(details.prevClose)
            : null,
          fiftyTwoWeekHigh: details.fiftyTwoWeekHigh
            ? new Decimal(details.fiftyTwoWeekHigh)
            : null,
          fiftyTwoWeekLow: details.fiftyTwoWeekLow
            ? new Decimal(details.fiftyTwoWeekLow)
            : null,
          exDividendDate: details.exDividendDate
            ? new Date(details.exDividendDate)
            : null,
          earningsDate: details.earningsDate
            ? new Date(details.earningsDate)
            : null,
        },
      });

      // Update Sectors
      // details.sectors is a Record<string, Decimal>
      if (details.sectors && Object.keys(details.sectors).length > 0) {
        await tx.etfSector.deleteMany({
          where: { etfId: ticker },
        });

        await tx.etfSector.createMany({
          data: Object.entries(details.sectors).map(([sector, weight]) => ({
            etfId: ticker,
            sector_name: sector,
            weight: new Decimal(weight),
          })),
        });
      }

      if (
        details.assetType === "ETF" &&
        details.topHoldings &&
        details.topHoldings.length > 0
      ) {
        await tx.holding.deleteMany({
          where: { etfId: ticker },
        });

        await tx.holding.createMany({
          data: details.topHoldings.map((h) => ({
            etfId: ticker,
            ticker: h.ticker,
            name: h.name,
            sector: h.sector || "Unknown",
            weight: new Decimal(h.weight),
            shares: null, // Scraper doesn't return shares
          })),
        });
      }

      if (includeHistory && details.history && details.history.length > 0) {
        const dates = details.history.map((h) => new Date(h.date));
        const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

        await tx.etfHistory.deleteMany({
          where: {
            etfId: ticker,
            date: {
              gte: minDate,
              lte: maxDate,
            },
            interval: "1d",
          },
        });

        await tx.etfHistory.createMany({
          data: details.history.map((h) => ({
            etfId: ticker,
            date: new Date(h.date),
            close: new Decimal(h.close), // Map close -> close (not price)
            interval: "1d",
          })),
        });
      }
    },
    {
      timeout: 60000,
      maxWait: 10000,
    },
  );

  return details;
}
