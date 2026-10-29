"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { indexedDbBarStore, loadBars, memoryBarStore, type BarStore } from "@/lib/lab/bar-cache";
import type { BacktestReport, BacktestRequest, Targets } from "@/lib/lab/engine/backtest";
import type { WorkerRequest, WorkerResponse } from "@/lib/lab/engine/worker";
import type { LabRequest } from "@/lib/lab/lab-form";
import { createStrategyClient, type StrategyClient } from "@/lib/lab/strategy/client";
import type { LookaheadResult, Params, StrategyError, StrategyLanguage } from "@/lib/lab/strategy/types";

export type EngineStatus = "starting" | "ready" | "loading-data" | "strategy" | "running" | "error";

export interface LabRun {
  id: number;
  name: string;
  request: LabRequest;
  report: BacktestReport;
  /** Wall time for the engine step, in ms. */
  engineMs: number;
  /** Wall time for a code strategy's weights() call, in ms. */
  strategyMs?: number;
  logs: string[];
  lookahead?: LookaheadResult;
  dataFetchedAt: string;
  /** Last completed session in the data. */
  dataThrough: string;
  /** Price requests this run made; 0 when every ticker came from the browser cache. */
  dataRequests: number;
  ranAt: string;
}

/** A code strategy failed; carries its console output and the line to mark in the editor. */
export class StrategyRunError extends Error {
  constructor(public readonly detail: StrategyError, public readonly logs: string[]) {
    super(detail.line ? `Line ${detail.line}: ${detail.message}` : detail.message);
  }
}

/** Loads bars through the IndexedDB cache, runs code strategies in their own workers, and the engine in another. */
export function useLabEngine() {
  const worker = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, (r: WorkerResponse) => void>());
  const store = useRef<BarStore | null>(null);
  const strategies = useRef<StrategyClient | null>(null);
  const nextId = useRef(1);
  const [status, setStatus] = useState<EngineStatus>("starting");
  const [pythonStatus, setPythonStatus] = useState<string | null>(null);

  useEffect(() => {
    const w = new Worker(new URL("../../lib/lab/engine/worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      pending.current.get(e.data.id)?.(e.data);
      pending.current.delete(e.data.id);
    };
    // A worker that fails to load or crashes never replies; settle every waiting run instead of hanging.
    const fail = (error: string) => {
      for (const [id, resolve] of pending.current) resolve({ id, ok: false, error });
      pending.current.clear();
      setStatus("error");
    };
    w.onerror = (e) => {
      e.preventDefault();
      fail("The backtest engine stopped unexpectedly. Reload the page to restart it.");
    };
    w.onmessageerror = () => fail("The backtest engine sent a result that could not be read.");
    worker.current = w;
    // loadBars tolerates a failing store, so a blocked IndexedDB only costs caching.
    store.current = typeof indexedDB === "undefined" ? memoryBarStore() : indexedDbBarStore();
    const client = createStrategyClient((language, message) => {
      if (language === "python") setPythonStatus(message);
    });
    strategies.current = client;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the worker exists only after mount
    setStatus("ready");
    const waiting = pending.current;
    return () => {
      w.terminate();
      client.dispose();
      waiting.clear();
    };
  }, []);

  const run = useCallback(async (name: string, request: LabRequest): Promise<LabRun> => {
    const w = worker.current;
    if (!w || !store.current || !strategies.current) throw new Error("The engine is still starting.");
    try {
      setStatus("loading-data");
      const bars = await loadBars(request.tickers, request.start, request.end, { store: store.current });
      const unavailable = bars.failed.filter((t) => !bars.series.some((s) => s.ticker === t));
      if (unavailable.length) {
        throw new Error(`Could not load ${unavailable.join(", ")} right now; the price service did not answer. Try again in a minute.`);
      }
      if (bars.missing.length) {
        throw new Error(`No price data for ${bars.missing.join(", ")} between ${request.start} and ${request.end}.`);
      }
      // The engine converts currencies, but the app has no long-range FX history yet.
      const foreign = bars.series.filter((s) => s.currency && s.currency !== "USD");
      if (foreign.length) {
        throw new Error(
          `${foreign.map((s) => `${s.ticker} (${s.currency})`).join(", ")} ${foreign.length > 1 ? "are" : "is"} not priced in USD. ` +
            "The Lab runs USD-listed portfolios only for now, because it does not yet have the exchange-rate history to convert.",
        );
      }

      const strategy = request.strategy;
      let targets: Targets;
      let logs: string[] = [];
      let lookahead: LookaheadResult | undefined;
      let strategyMs: number | undefined;
      if (strategy.kind === "code") {
        setStatus("strategy");
        // The strategy sees its own universe only, not the benchmark.
        const universe = bars.series.filter((s) => strategy.universe.includes(s.ticker));
        const result = await strategies.current.run(strategy.language, strategy.code, strategy.params, universe, "USD");
        if (!result.ok) throw new StrategyRunError(result.error, result.logs);
        targets = { matrix: result.weights, dates: result.dates, tickers: result.tickers };
        ({ logs, lookahead } = result);
        strategyMs = result.ms;
      } else {
        targets = { strategy };
      }

      setStatus("running");
      const id = nextId.current++;
      const started = performance.now();
      const body: BacktestRequest = {
        series: bars.series,
        config: request.config,
        baseCurrency: "USD",
        targets,
        benchmark: request.benchmark,
        strategy: strategy.kind === "code"
          ? { code: strategy.code, params: { language: strategy.language, universe: strategy.universe, ...strategy.params } }
          : { code: JSON.stringify(strategy) },
      };
      const response = await new Promise<WorkerResponse>((resolve) => {
        pending.current.set(id, resolve);
        w.postMessage({ id, request: body } satisfies WorkerRequest);
      });
      if (!response.ok) throw new Error(response.error);

      setStatus("ready");
      const fetched = bars.series.map((s) => s.source.fetchedAt).sort();
      return {
        id,
        name,
        request,
        report: response.report,
        engineMs: performance.now() - started,
        ...(strategyMs !== undefined ? { strategyMs } : {}),
        logs,
        ...(lookahead ? { lookahead } : {}),
        dataFetchedAt: fetched[0] ?? new Date().toISOString(),
        dataThrough: bars.through,
        dataRequests: bars.requests,
        ranAt: new Date().toISOString(),
      };
    } catch (error) {
      setStatus("error");
      throw error;
    }
  }, []);

  const inspect = useCallback(
    (language: StrategyLanguage, code: string): Promise<{ params: Params | null; error?: StrategyError }> =>
      strategies.current?.inspect(language, code) ?? Promise.resolve({ params: null }),
    [],
  );
  return { status, pythonStatus, run, inspect };
}
