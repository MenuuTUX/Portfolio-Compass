/// <reference lib="webworker" />
import { runBacktest, type BacktestRequest } from "@/lib/lab/engine/backtest";

// Runs backtests off the main thread. Load with
// `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`.

export type WorkerRequest = { id: number; request: BacktestRequest };
export type WorkerResponse =
  | { id: number; ok: true; report: Awaited<ReturnType<typeof runBacktest>> }
  | { id: number; ok: false; error: string };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, request } = event.data;
  try {
    const report = await runBacktest(request);
    const transfer = [report.sim.equity, report.sim.cash, report.sim.flows, report.sim.holdings]
      .map((a) => a.buffer);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, ok: true, report } satisfies WorkerResponse, transfer);
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) } satisfies WorkerResponse);
  }
};
