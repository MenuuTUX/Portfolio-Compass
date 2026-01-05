import { NextResponse } from "next/server";
import { fetchFearAndGreedIndex } from "@/lib/scrapers/fear-greed";

export const dynamic = "force-dynamic"; // We might want to respect the fetch cache, but API route usually dynamic unless we rely on next fetch cache

export async function GET() {
  try {
    const data = await fetchFearAndGreedIndex();
    return NextResponse.json(data);
  } catch (error) {
    console.error("API Error fetching Fear & Greed Index:", error);
    return NextResponse.json(
      { error: "Failed to fetch Fear & Greed Index" },
      { status: 500 },
    );
  }
}
