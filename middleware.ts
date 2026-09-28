import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-IP rate limit for the API routes.
 *
 * Every route under /api proxies an upstream provider (Yahoo, stockanalysis,
 * etf.com, CNN). Without a cap, one scraper burns our upstream quota and gets
 * the deployment blocked, which takes the site down for everyone.
 *
 * ponytail: in-memory token bucket, so the budget is per serverless instance
 * rather than global. That is enough to stop a single abusive client. Move to
 * Vercel KV or Upstash if the app ever needs an exact global limit.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest): string {
  // Vercel sets x-forwarded-for; the first entry is the real client.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function middleware(request: NextRequest) {
  const ip = clientIp(request);
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    // Bound the map so a burst of unique IPs cannot grow it without limit.
    if (hits.size > 10_000) {
      for (const [key, value] of hits) if (value.resetAt <= now) hits.delete(key);
    }
    return NextResponse.next();
  }

  entry.count += 1;

  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Slow down and try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
