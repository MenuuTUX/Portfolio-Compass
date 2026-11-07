import { NextRequest } from "next/server";
import { getFastWebsiteDomain } from "@/lib/fast-market";
import { isTicker } from "@/lib/tickers";
import { cacheHeaders } from "@/lib/http-cache";

export const maxDuration = 20;

const FOUND_TTL_MS = 24 * 60 * 60_000;
const MISS_TTL_MS = 60 * 60_000;
const FETCH_TIMEOUT_MS = 4000;
const MAX_ENTRIES = 1500;
const MIN_BYTES = 200;

interface Logo {
  body: Uint8Array<ArrayBuffer>;
  contentType: string;
  found: boolean;
  expires: number;
}

const cache = new Map<string, Logo>();
const inflight = new Map<string, ReturnType<typeof findLogo>>();

async function fetchImage(url: string): Promise<{ body: Uint8Array<ArrayBuffer>; contentType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const body = new Uint8Array(await res.arrayBuffer());
    return body.byteLength >= MIN_BYTES ? { body, contentType } : null;
  } catch {
    return null;
  }
}

// Sources are tried in order of quality; the first real image wins.
async function findLogo(ticker: string) {
  const clientId = process.env.BRANDFETCH_CLIENT_ID;
  const t = encodeURIComponent(ticker);

  const brandfetch = async () => {
    if (!clientId) return null;
    const hit = await fetchImage(
      `https://cdn.brandfetch.io/ticker/${t}/w/256/h/256/fallback/404?c=${encodeURIComponent(clientId)}`,
    );
    if (hit) return hit;
    const domain = await getFastWebsiteDomain(ticker);
    if (!domain) return null;
    return fetchImage(
      `https://cdn.brandfetch.io/domain/${encodeURIComponent(domain)}/w/256/h/256/fallback/404?c=${encodeURIComponent(clientId)}`,
    );
  };

  // Race all sources at once instead of waiting out each timeout in turn;
  // results are still picked in quality order.
  const results = await Promise.all([
    brandfetch(),
    fetchImage(`https://cdn.jsdelivr.net/gh/nvstly/icons@main/ticker_icons/${t}.png`),
    fetchImage(`https://financialmodelingprep.com/image-stock/${t}.png`),
  ]);
  return results.find(Boolean) ?? null;
}

function monogram(ticker: string) {
  const label = ticker.replace(/[^A-Z0-9.-]/gi, "").toUpperCase().slice(0, 5) || "?";
  // Shrink with length so the whole ticker fits the 64px tile
  const size = Math.max(11, Math.min(26, Math.floor(52 / (label.length * 0.62))));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="#2a2a2a"/>` +
    `<text x="32" y="32" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" ` +
    `font-size="${size}" font-weight="700" fill="#e8e8e8">${label}</text></svg>`;
  return { body: new TextEncoder().encode(svg), contentType: "image/svg+xml" };
}

function respond(logo: Logo) {
  // Real logos are cached at Vercel's CDN as well; monograms only in the browser.
  const cache = logo.found
    ? cacheHeaders({ browser: 86_400, cdn: 86_400, swr: 604_800 })
    : { "Cache-Control": "public, max-age=3600" };
  return new Response(logo.body, {
    headers: {
      "Content-Type": logo.contentType,
      ...cache,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: raw } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return new Response("Invalid ticker", { status: 400 });
  }
  if (!isTicker(decoded)) return new Response("Invalid ticker", { status: 400 });
  const key = decoded.toUpperCase();

  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return respond(hit);

  let pending = inflight.get(key);
  if (!pending) {
    pending = findLogo(key).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  const found = await pending;
  const logo: Logo = found
    ? { ...found, found: true, expires: Date.now() + FOUND_TTL_MS }
    : { ...monogram(key), found: false, expires: Date.now() + MISS_TTL_MS };

  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, logo);
  return respond(logo);
}
