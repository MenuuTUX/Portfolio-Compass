/// <reference lib="webworker" />
import { buildFrame } from "@/lib/lab/engine/frame";
import { compileTypeScript, computeTsWeights, instantiate, locateError } from "@/lib/lab/strategy/ts-runner";
import type { PriceMatrix, StrategyRequest, StrategyResponse } from "@/lib/lab/strategy/types";
import { checkLookahead } from "@/lib/lab/strategy/weights";

// Runs TypeScript strategies off the main thread, apart from the engine
// worker, so strategy code cannot touch the engine's state.
//
// Network and storage APIs are removed before any strategy runs, so a strategy
// sees only the prices it is given and cannot read saved strategies. It is a
// guard against accidents and copied code, not a hardened sandbox.
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "BroadcastChannel"]) {
  try {
    Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false });
  } catch {
    // Already non-configurable in this browser; nothing more to do.
  }
}

const post = (msg: StrategyResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);

self.onmessage = async (event: MessageEvent<StrategyRequest>) => {
  const msg = event.data;
  if (msg.op === "inspect") {
    try {
      post({ id: msg.id, op: "inspect", params: instantiate(compileTypeScript(msg.code), { lines: [] }).params });
    } catch (error) {
      post({ id: msg.id, op: "inspect", params: null, error: locateError(error) });
    }
    return;
  }

  const sink = { lines: [] as string[] };
  try {
    const started = performance.now();
    const frame = buildFrame(msg.series, { baseCurrency: msg.baseCurrency });
    const prices: PriceMatrix = { dates: frame.dates, tickers: frame.tickers, adjClose: frame.adjClose };
    const js = compileTypeScript(msg.code);
    const weights = computeTsWeights(instantiate(js, sink), prices, msg.params);
    const ms = performance.now() - started;
    // Rerun on truncated history with a separate console, so its output does not repeat in the log.
    const quiet = instantiate(js, { lines: [] });
    const lookahead = await checkLookahead(prices, weights, (p) => computeTsWeights(quiet, p, msg.params));
    post({ id: msg.id, op: "run", result: { ok: true, weights, dates: prices.dates, tickers: prices.tickers, logs: sink.lines, lookahead, ms } });
  } catch (error) {
    post({ id: msg.id, op: "run", result: { ok: false, error: locateError(error), logs: sink.lines } });
  }
};
