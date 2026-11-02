/// <reference lib="webworker" />
import { runBacktest, type BacktestRequest } from "@/lib/lab/engine/backtest";
import { sweepTrend, type RobustnessRequest, type RobustnessResult } from "@/lib/lab/engine/sweep";

// Runs backtests off the main thread. Load with
// `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`.
// A `robustness` request runs a parameter sweep and walk-forward test, which
// is many backtests, so it also stays off the main thread.

export type WorkerRequest = { id: number; request: BacktestRequest } | { id: number; robustness: RobustnessRequest };
export type WorkerResponse =
  | { id: number; ok: true; report: Awaited<ReturnType<typeof runBacktest>> }
  | { id: number; ok: true; robustness: RobustnessResult }
  | { id: number; ok: false; error: string };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;
  try {
    if ("robustness" in data) {
      const robustness = await sweepTrend(data.robustness);
      self.postMessage({ id: data.id, ok: true, robustness } satisfies WorkerResponse);
      return;
    }
    const report = await runBacktest(data.request);
    const transfer = [report.sim.equity, report.sim.cash, report.sim.flows, report.sim.holdings]
      .map((a) => a.buffer);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id: data.id, ok: true, report } satisfies WorkerResponse, transfer);
  } catch (error) {
    self.postMessage({ id: data.id, ok: false, error: error instanceof Error ? error.message : String(error) } satisfies WorkerResponse);
  }
};
