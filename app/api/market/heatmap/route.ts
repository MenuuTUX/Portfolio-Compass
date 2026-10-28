import { NextRequest, NextResponse } from "next/server";
import { getFastQuotes } from "@/lib/fast-market";
import { DEFAULT_HEATMAP_GROUP, getHeatmapGroup } from "@/config/sp500-heatmap";

export const maxDuration = 30;

export interface HeatmapStock {
  ticker: string;
  name: string;
  changePercent: number;
  marketCap: number;
}

export interface HeatmapPayload {
  group: string;
  label: string;
  updatedAt: string;
  /** Day change of the index proxy (an ETF, or the cap-weighted members when there is none). */
  benchmark: { ticker: string | null; changePercent: number } | null;
  sectors: { name: string; stocks: HeatmapStock[] }[];
}

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("group") ?? DEFAULT_HEATMAP_GROUP;
  const group = getHeatmapGroup(requested);
  if (!group) return NextResponse.json({ error: "Unknown group" }, { status: 400 });

  try {
    const tickers = Object.values(group.sectors).flat();
    const quotes = await getFastQuotes(group.benchmark ? [...tickers, group.benchmark] : tickers);

    const sectors = Object.entries(group.sectors).map(([name, members]) => {
      const stocks: HeatmapStock[] = [];
      for (const ticker of members) {
        const q = quotes.get(ticker.toUpperCase());
        if (!q || !q.marketCap || !Number.isFinite(q.changePercent)) continue;
        stocks.push({ ticker, name: q.name, changePercent: q.changePercent, marketCap: q.marketCap });
      }
      return { name, stocks };
    }).filter((s) => s.stocks.length > 0);

    if (sectors.length === 0) {
      return NextResponse.json({ error: "No quotes available" }, { status: 502 });
    }

    let benchmark: HeatmapPayload["benchmark"] = null;
    const proxy = group.benchmark ? quotes.get(group.benchmark) : undefined;
    if (proxy) {
      benchmark = { ticker: group.benchmark, changePercent: proxy.changePercent };
    } else {
      const all = sectors.flatMap((s) => s.stocks);
      const cap = all.reduce((n, s) => n + s.marketCap, 0);
      benchmark = { ticker: null, changePercent: all.reduce((n, s) => n + s.changePercent * s.marketCap, 0) / cap };
    }

    const payload: HeatmapPayload = {
      group: group.id,
      label: group.label,
      updatedAt: new Date().toISOString(),
      benchmark,
      sectors,
    };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("[API] Heatmap failed:", error);
    return NextResponse.json({ error: "Failed to load heatmap" }, { status: 502 });
  }
}
