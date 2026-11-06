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
/** Logos are cached for a day at the CDN; this stops a scraper minting new keys. */
const MAX_LOGO_REQUESTS = 600;
/** Prune expired buckets once the map passes this size. */
const PRUNE_AT = 5_000;
/** Hard cap: when pruning frees too little, the oldest buckets go first. */
const MAX_BUCKETS = 10_000;

const hits = new Map<string, { count: number; resetAt: number }>();

/** Short, stable hash so a client without IP headers still gets its own bucket. */
function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function clientKey(request: NextRequest): string {
  // Vercel sets x-forwarded-for; the first entry is the real client.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const fingerprint = `${request.headers.get("user-agent") ?? ""}|${request.headers.get("accept-language") ?? ""}`;
  return `anon-${shortHash(fingerprint)}`;
}

function prune(now: number) {
  for (const [key, value] of hits) if (value.resetAt <= now) hits.delete(key);
  for (const key of hits.keys()) {
    if (hits.size <= MAX_BUCKETS) break;
    hits.delete(key);
  }
}

export function proxy(request: NextRequest) {
  const isLogo = request.nextUrl.pathname.startsWith("/api/logo/");
  const limit = isLogo ? MAX_LOGO_REQUESTS : MAX_REQUESTS;
  const key = `${isLogo ? "logo" : "api"}:${clientKey(request)}`;
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    // Bound the map so a burst of unique clients cannot grow it without limit.
    if (hits.size > PRUNE_AT) prune(now);
    return NextResponse.next();
  }

  entry.count += 1;

  if (entry.count > limit) {
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
