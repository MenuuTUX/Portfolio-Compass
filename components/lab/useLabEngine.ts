"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BarSeries } from "@/lib/lab/bar-types";
import { indexedDbBarStore, loadBars, memoryBarStore, type BarStore } from "@/lib/lab/bar-cache";
import type { BacktestReport, BacktestRequest, Targets } from "@/lib/lab/engine/backtest";
import type { FxSeries } from "@/lib/lab/engine/frame";
import { DEFAULT_SMA_VALUES, sweepValues, type RobustnessRequest, type RobustnessResult, type TrendStrategy } from "@/lib/lab/engine/sweep";
import { loadUsdCadSeries } from "@/lib/lab/fx";
import type { WorkerRequest, WorkerResponse } from "@/lib/lab/engine/worker";
import { warmupDaysFor, type LabRequest } from "@/lib/lab/lab-form";
import { createStrategyClient, type StrategyClient } from "@/lib/lab/strategy/client";
import type { LookaheadResult, Params, StrategyError, StrategyLanguage } from "@/lib/lab/strategy/types";

type EngineStatus = "starting" | "ready" | "loading-data" | "strategy" | "running" | "error";

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
  /** Tickers that ran on an older cached copy because the refresh failed, with that copy's last bar. */
  staleTickers?: { ticker: string; lastBar: string }[];
  ranAt: string;
}

/** USD/CAD rates for the CAD series in `series`, from their first bar through `end`; undefined when there are none. */
async function cadRates(series: BarSeries[], end: string): Promise<FxSeries | undefined> {
  if (!series.some((s) => s.currency === "CAD")) return undefined;
  const first = series.map((s) => s.bars[0]?.date).filter((d): d is string => Boolean(d)).sort()[0];
  return { CAD: await loadUsdCadSeries(first ?? end, end) };
}

type BarLoad = Awaited<ReturnType<typeof loadBars>>;

/**
 * Loads a request's bars and USD/CAD rates. `validate` throws the caller's own error for data it
 * cannot run on, after the bars arrive and before any rate history is fetched.
 */
async function prepareRun(
  request: LabRequest,
  store: BarStore,
  warmupDays: number,
  validate: (bars: BarLoad) => void,
) {
  const bars = await loadBars(request.tickers, request.start, request.end, { store, warmupDays });
  validate(bars);
  const fx = await cadRates(bars.series, request.end);
  const shared = {
    series: bars.series,
    config: request.config,
    baseCurrency: "USD" as const,
    ...(fx ? { fx } : {}),
    start: request.start,
    benchmark: request.benchmark,
  };
  return { bars, shared };
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
      const strategy = request.strategy;
      const { bars, shared } = await prepareRun(request, store.current, warmupDaysFor(strategy), (loaded) => {
        const unavailable = loaded.failed.filter((t) => !loaded.series.some((s) => s.ticker === t));
        if (unavailable.length) {
          throw new Error(`Could not load ${unavailable.join(", ")} right now; the price service did not answer. Try again in a minute.`);
        }
        if (loaded.missing.length) {
          throw new Error(`No price data for ${loaded.missing.join(", ")} between ${request.start} and ${request.end}.`);
        }
        // The engine converts currencies. The Lab has USD/CAD history, so CAD tickers work in no-code runs only:
        // the strategy workers take no FX series.
        const foreign = loaded.series.filter((s) => s.currency && s.currency !== "USD");
        if (foreign.length && (strategy.kind === "code" || foreign.some((s) => s.currency !== "CAD"))) {
          const list = `${foreign.map((s) => `${s.ticker} (${s.currency})`).join(", ")} ${foreign.length > 1 ? "are" : "is"} not priced in USD.`;
          throw new Error(
            strategy.kind === "code"
              ? `${list} Code strategies run USD-listed portfolios only. CAD funds work in no-code mode.`
              : `${list} The Lab converts USD and CAD prices only for now, because it has exchange-rate history for those two.`,
          );
        }
      });
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
        ...shared,
        targets,
        strategy: strategy.kind === "code"
          ? { code: strategy.code, params: { language: strategy.language, universe: strategy.universe, ...strategy.params } }
          : { code: JSON.stringify(strategy) },
      };
      const response = await new Promise<WorkerResponse>((resolve) => {
        pending.current.set(id, resolve);
        w.postMessage({ id, request: body } satisfies WorkerRequest);
      });
      if (!response.ok) throw new Error(response.error);
      if (!("report" in response)) throw new Error("The backtest engine sent an unexpected reply.");

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
        // A stale ticker stops at its old last bar, so the data is only as current as the oldest one.
        dataThrough: bars.staleTickers.length ? bars.staleTickers.map((t) => t.lastBar).sort()[0] : bars.through,
        dataRequests: bars.requests,
        ...(bars.staleTickers.length ? { staleTickers: bars.staleTickers } : {}),
        ranAt: new Date().toISOString(),
      };
    } catch (error) {
      setStatus("error");
      throw error;
    }
  }, []);

  /** Sweeps the moving-average length of a finished no-code trend run, and walk-forward tests the sweep, in the engine worker. */
  const robustness = useCallback(async (run: LabRun): Promise<RobustnessResult> => {
    const w = worker.current;
    const strategy = run.request.strategy;
    if (!w || !store.current) throw new Error("The engine is still starting.");
    if (strategy.kind !== "trend") throw new Error("Only the no-code trend rule can be swept.");
    const values = sweepValues(strategy.smaDays, DEFAULT_SMA_VALUES);
    const { shared } = await prepareRun(run.request, store.current, warmupDaysFor(strategy, Math.max(...values)), (bars) => {
      if (bars.failed.length || bars.missing.length) throw new Error("The price data for this run could not be loaded again. Try again in a minute.");
    });
    const id = nextId.current++;
    const body: RobustnessRequest = { ...shared, strategy: strategy as TrendStrategy, values };
    const response = await new Promise<WorkerResponse>((resolve) => {
      pending.current.set(id, resolve);
      w.postMessage({ id, robustness: body } satisfies WorkerRequest);
    });
    if (!response.ok) throw new Error(response.error);
    if (!("robustness" in response)) throw new Error("The backtest engine sent an unexpected reply.");
    return response.robustness;
  }, []);

  const inspect = useCallback(
    (language: StrategyLanguage, code: string): Promise<{ params: Params | null; error?: StrategyError }> =>
      strategies.current?.inspect(language, code) ?? Promise.resolve({ params: null }),
    [],
  );
  return { status, pythonStatus, run, robustness, inspect };
}
