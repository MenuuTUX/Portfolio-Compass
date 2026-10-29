/// <reference lib="webworker" />
import { buildFrame } from "@/lib/lab/engine/frame";
import { COMPASS_PY, HARNESS_PY, PYODIDE_URL } from "@/lib/lab/strategy/python";
import { cleanParams, MAX_LOG_LINES, type PriceMatrix, type StrategyError, type StrategyRequest, type StrategyResponse } from "@/lib/lab/strategy/types";
import { checkLookahead } from "@/lib/lab/strategy/weights";

// Runs Python strategies in Pyodide. Pyodide (about 14 MB with numpy and
// pandas, cached by the browser after the first visit) comes from jsDelivr, so
// it costs this site no bandwidth. It loads on the first Python request only.

interface PyProxy {
  toJs(): unknown;
  destroy(): void;
}
interface Pyodide {
  loadPackage(names: string[]): Promise<void>;
  loadPackagesFromImports(code: string): Promise<void>;
  runPython(code: string): unknown;
  globals: { get(name: string): (...args: unknown[]) => unknown };
  FS: { writeFile(path: string, data: string): void };
  setStdout(opts: { batched: (s: string) => void }): void;
  setStderr(opts: { batched: (s: string) => void }): void;
}

const post = (msg: StrategyResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);

// Strategies may only reach the Pyodide CDN (to load packages such as scipy on import), nothing else.
const realFetch = self.fetch.bind(self);
self.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.startsWith(PYODIDE_URL) ? realFetch(input, init) : Promise.reject(new TypeError("Network access is not available to strategies."));
}) as typeof fetch;

let logs: string[] = [];
let quiet = false;
const capture = (prefix: string) => (s: string) => {
  if (quiet) return;
  if (logs.length < MAX_LOG_LINES) logs.push(prefix + s);
  else if (logs.length === MAX_LOG_LINES) logs.push(`… output stopped after ${MAX_LOG_LINES} lines`);
};

let booting: Promise<Pyodide> | null = null;
function boot(): Promise<Pyodide> {
  booting ??= (async () => {
    post({ id: -1, op: "status", message: "Loading Python…" });
    const { loadPyodide } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${PYODIDE_URL}pyodide.mjs`);
    const py: Pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
    post({ id: -1, op: "status", message: "Loading numpy and pandas…" });
    await py.loadPackage(["numpy", "pandas"]);
    py.FS.writeFile("/home/pyodide/compass.py", COMPASS_PY);
    py.runPython(HARNESS_PY);
    py.setStdout({ batched: capture("") });
    py.setStderr({ batched: capture("error: ") });
    // Pyodide is loaded; from here strategies get no other network or storage API.
    // fetch stays, limited to the Pyodide CDN, so packages can load on import.
    for (const name of ["XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "BroadcastChannel"]) {
      try {
        Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false });
      } catch {
        // Already non-configurable in this browser.
      }
    }
    post({ id: -1, op: "status", message: "Python ready" });
    return py;
  })();
  booting.catch(() => {
    booting = null;
  });
  return booting;
}

function pyError(error: unknown): StrategyError {
  // A PythonError's message is the full traceback; keep its last line and the deepest strategy.py frame.
  const message = error instanceof Error ? error.message : String(error);
  const lines = [...message.matchAll(/File "strategy\.py", line (\d+)/g)];
  const last = message.trim().split("\n").filter(Boolean).pop() ?? message;
  return { message: last, ...(lines.length ? { line: Number(lines[lines.length - 1][1]) } : {}) };
}

function call<T>(py: Pyodide, fn: string, ...args: unknown[]): T {
  return py.globals.get(fn)(...args) as T;
}

self.onmessage = async (event: MessageEvent<StrategyRequest>) => {
  const msg = event.data;
  let py: Pyodide;
  try {
    py = await boot();
  } catch (error) {
    const text = `Python could not load: ${error instanceof Error ? error.message : String(error)}. Check your connection; it comes from cdn.jsdelivr.net.`;
    if (msg.op === "run") post({ id: msg.id, op: "run", result: { ok: false, error: { message: text }, logs: [] } });
    else post({ id: msg.id, op: "inspect", params: null, error: { message: text } });
    return;
  }

  try {
    // scipy, statsmodels and other Pyodide packages load on import, from the same CDN.
    await py.loadPackagesFromImports(msg.code);
  } catch {
    // An unknown import fails with a clear Python error when the code runs.
  }

  if (msg.op === "inspect") {
    try {
      const json = call<string>(py, "_lab_params", msg.code);
      post({ id: msg.id, op: "inspect", params: cleanParams(JSON.parse(json)) });
    } catch (error) {
      post({ id: msg.id, op: "inspect", params: null, error: pyError(error) });
    }
    return;
  }

  logs = [];
  quiet = false;
  let ns: PyProxy | null = null;
  try {
    const started = performance.now();
    const frame = buildFrame(msg.series, { baseCurrency: msg.baseCurrency });
    const prices: PriceMatrix = { dates: frame.dates, tickers: frame.tickers, adjClose: frame.adjClose };
    ns = call<PyProxy>(py, "_lab_load", msg.code);
    const compute = (p: PriceMatrix) => {
      const out = call<PyProxy>(py, "_lab_weights", ns, p.adjClose, p.dates.length, p.tickers.length, p.dates, p.tickers, JSON.stringify(msg.params));
      const arr = Float64Array.from(out.toJs() as ArrayLike<number>);
      out.destroy();
      return arr;
    };
    const weights = compute(prices);
    const ms = performance.now() - started;
    quiet = true;
    const lookahead = await checkLookahead(prices, weights, compute);
    quiet = false;
    post({ id: msg.id, op: "run", result: { ok: true, weights, dates: prices.dates, tickers: prices.tickers, logs, lookahead, ms } });
  } catch (error) {
    quiet = false;
    post({ id: msg.id, op: "run", result: { ok: false, error: pyError(error), logs } });
  } finally {
    ns?.destroy();
  }
};
