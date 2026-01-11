import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const addRedditCommunitySchema = z.object({
  ticker: z.string().min(1).max(12).regex(/^[A-Z0-9.-]+$/i),
  subreddit: z.string().min(1).max(50),
  url: z.string().url().optional(),
});

const removeRedditCommunitySchema = z.object({
  ticker: z.string().min(1).max(12).regex(/^[A-Z0-9.-]+$/i),
  subreddit: z.string().min(1).max(50),
});

// GET: Fetch Reddit communities for a ticker
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json(
      { error: "Ticker parameter is required" },
      { status: 400 },
    );
  }

  try {
    const communities = await prisma.redditCommunity.findMany({
      where: {
        etfId: ticker.toUpperCase(),
      },
      orderBy: {
        subreddit: "asc",
      },
    });

    return NextResponse.json(
      communities.map((c) => ({
        subreddit: c.subreddit,
        url: c.url || `https://reddit.com/r/${c.subreddit}`,
      })),
    );
  } catch (error) {
    console.error("[API] Error fetching Reddit communities:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// POST: Add a Reddit community to a ticker
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = addRedditCommunitySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.errors },
        { status: 400 },
      );
    }

    const { ticker, subreddit, url } = validation.data;
    const normalizedTicker = ticker.toUpperCase();

    // Verify ticker exists
    const etf = await prisma.etf.findUnique({
      where: { ticker: normalizedTicker },
    });

    if (!etf) {
      return NextResponse.json(
        { error: "Ticker not found" },
        { status: 404 },
      );
    }

    // Create or update Reddit community
    const community = await prisma.redditCommunity.upsert({
      where: {
        etfId_subreddit: {
          etfId: normalizedTicker,
          subreddit: subreddit.toLowerCase(),
        },
      },
      update: {
        url: url || `https://reddit.com/r/${subreddit}`,
      },
      create: {
        etfId: normalizedTicker,
        subreddit: subreddit.toLowerCase(),
        url: url || `https://reddit.com/r/${subreddit}`,
      },
    });

    return NextResponse.json({
      subreddit: community.subreddit,
      url: community.url || `https://reddit.com/r/${community.subreddit}`,
    });
  } catch (error: any) {
    console.error("[API] Error adding Reddit community:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Community already exists for this ticker" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// DELETE: Remove a Reddit community from a ticker
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = removeRedditCommunitySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.errors },
        { status: 400 },
      );
    }

    const { ticker, subreddit } = validation.data;
    const normalizedTicker = ticker.toUpperCase();

    await prisma.redditCommunity.delete({
      where: {
        etfId_subreddit: {
          etfId: normalizedTicker,
          subreddit: subreddit.toLowerCase(),
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Error removing Reddit community:", error);
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
