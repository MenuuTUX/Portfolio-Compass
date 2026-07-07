// Bulk warm-up: deep-syncs every ticker in the database so the UI serves
// charts, metrics, sectors, and holdings instantly instead of syncing
// on-demand when a drawer opens. Uses the same free sources as the app
// (Yahoo public endpoints + stockanalysis.com) with rate-limit-aware
// concurrency and skip-if-fresh so re-runs are cheap.
//
// Usage:
//   bun run db:sync-all            # hydrate stale/shallow rows only
//   bun run db:sync-all -- --force # re-sync everything
import prisma from "../lib/db";
import { syncEtfDetails } from "../lib/etf-sync";
import pLimit from "p-limit";

const FRESH_MS = 12 * 60 * 60 * 1000; // deep data considered fresh for 12h
const MIN_HISTORY_POINTS = 200; // enough daily candles for charts + Monte Carlo
const CONCURRENCY = 3;

async function main() {
  const force = process.argv.includes("--force");

  const rows = await prisma.etf.findMany({
    select: {
      ticker: true,
      isDeepAnalysisLoaded: true,
      updatedAt: true,
      _count: { select: { history: true } },
    },
    orderBy: { ticker: "asc" },
  });

  const now = Date.now();
  const targets = rows.filter((row) => {
    if (force) return true;
    if (!row.isDeepAnalysisLoaded) return true;
    if (row._count.history < MIN_HISTORY_POINTS) return true;
    if (now - row.updatedAt.getTime() > FRESH_MS) return true;
    return false;
  });

  console.log(
    `[SyncAll] ${rows.length} tickers in DB — ${targets.length} need hydration${force ? " (forced)" : ""}`,
  );
  if (targets.length === 0) {
    console.log("[SyncAll] Everything is already fresh. ✅");
    await prisma.$disconnect();
    return;
  }

  const limit = pLimit(CONCURRENCY);
  const startedAt = Date.now();
  let done = 0;
  let ok = 0;
  const failedTickers: string[] = [];

  await Promise.all(
    targets.map((row) =>
      limit(async () => {
        try {
          const synced = await syncEtfDetails(row.ticker, [
            "1h",
            "1d",
            "1wk",
            "1mo",
          ]);
          if (synced) ok++;
          else failedTickers.push(row.ticker);
        } catch (err: any) {
          failedTickers.push(row.ticker);
          console.warn(`[SyncAll] ${row.ticker} failed: ${err?.message}`);
        }

        done++;
        if (done % 10 === 0 || done === targets.length) {
          const elapsed = (Date.now() - startedAt) / 1000;
          const etaSec = Math.round((targets.length - done) / (done / elapsed));
          console.log(
            `[SyncAll] ${done}/${targets.length} (ok ${ok}, failed ${failedTickers.length}) — ETA ~${Math.floor(etaSec / 60)}m${etaSec % 60}s`,
          );
        }
      }),
    ),
  );

  const minutes = ((Date.now() - startedAt) / 60000).toFixed(1);
  console.log(
    `[SyncAll] Done in ${minutes} min: ${ok} hydrated, ${failedTickers.length} failed.`,
  );
  if (failedTickers.length) {
    console.log(
      `[SyncAll] Failed (re-run to retry): ${failedTickers.join(", ")}`,
    );
  }
  await prisma.$disconnect();
}

main();
