import { cacheHeaders, CACHE } from "@/lib/http-cache";
import { NextResponse } from "next/server";
import { fetchFearAndGreedIndex } from "@/lib/scrapers/fear-greed";
import { jsonError } from "@/lib/api";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchFearAndGreedIndex();
    return NextResponse.json(data, { headers: cacheHeaders(CACHE.fearGreed) });
  } catch (error) {
    return jsonError(500, "Failed to fetch Fear & Greed Index", "API Error fetching Fear & Greed Index:", error);
  }
}
