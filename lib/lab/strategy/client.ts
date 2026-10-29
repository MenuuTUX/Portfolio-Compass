import type { BarSeries } from "@/lib/lab/bar-types";
import type { Params, StrategyLanguage, StrategyRequest, StrategyResponse, StrategyResult, StrategyError } from "@/lib/lab/strategy/types";

// Page-side handle on the strategy workers. Each language gets its own worker,
// created on first use, so the TypeScript path never downloads Python. A run
// that exceeds its time limit has its worker terminated (the only way to stop
// an infinite loop) and the next run starts a fresh one.

const RUN_LIMIT_MS = 30_000;
/** First Python request also downloads Pyodide, numpy and pandas. */
const BOOT_LIMIT_MS = 120_000;

/** A request without its id; distributes over the union so each op keeps its own fields. */
type RequestBody = StrategyRequest extends infer R ? (R extends StrategyRequest ? Omit<R, "id"> : never) : never;

type Pending = { resolve: (r: StrategyResponse) => void; timer: ReturnType<typeof setTimeout> };

export interface StrategyClient {
  run(language: StrategyLanguage, code: string, params: Params, series: BarSeries[], baseCurrency: string): Promise<StrategyResult>;
  inspect(language: StrategyLanguage, code: string): Promise<{ params: Params | null; error?: StrategyError }>;
  dispose(): void;
}

export function createStrategyClient(onStatus: (language: StrategyLanguage, message: string) => void): StrategyClient {
  const workers = new Map<StrategyLanguage, Worker>();
  const booted = new Set<StrategyLanguage>();
  const pending = new Map<number, Pending>();
  let nextId = 1;

  const spawn = (language: StrategyLanguage): Worker => {
    // Literal URLs so the bundler emits each worker as its own chunk.
    const w = language === "python"
      ? new Worker(new URL("./py-worker.ts", import.meta.url), { type: "module" })
      : new Worker(new URL("./ts-worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<StrategyResponse>) => {
      const msg = e.data;
      if (msg.op === "status") return onStatus(language, msg.message);
      // Any reply means the runtime is loaded, so later requests get the short limit.
      booted.add(language);
      const p = pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(msg.id);
      p.resolve(msg);
    };
    w.onerror = (e) => {
      e.preventDefault();
      kill(language, "The strategy worker stopped unexpectedly.");
    };
    workers.set(language, w);
    return w;
  };

  /** Ids of requests sent to each worker, so a kill only fails that worker's requests. */
  const owner = new Map<number, StrategyLanguage>();

  const kill = (language: StrategyLanguage, message: string) => {
    workers.get(language)?.terminate();
    workers.delete(language);
    booted.delete(language);
    for (const [id, p] of pending) {
      if (owner.get(id) !== language) continue;
      clearTimeout(p.timer);
      pending.delete(id);
      p.resolve({ id, op: "run", result: { ok: false, error: { message }, logs: [] } });
    }
  };

  const send = (language: StrategyLanguage, body: RequestBody): Promise<StrategyResponse> => {
    const w = workers.get(language) ?? spawn(language);
    const id = nextId++;
    owner.set(id, language);
    const limit = booted.has(language) || language === "typescript" ? RUN_LIMIT_MS : BOOT_LIMIT_MS;
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => kill(language, `Stopped after ${limit / 1000} s. Check for an endless loop, or shorten the period.`),
        limit,
      );
      pending.set(id, { resolve, timer });
      w.postMessage({ ...body, id } as StrategyRequest);
    }).finally(() => owner.delete(id)) as Promise<StrategyResponse>;
  };

  return {
    async run(language, code, params, series, baseCurrency) {
      const res = await send(language, { op: "run", code, params, series, baseCurrency });
      return res.op === "run" ? res.result : { ok: false, error: { message: "Unexpected reply from the strategy worker." }, logs: [] };
    },
    async inspect(language, code) {
      const res = await send(language, { op: "inspect", code });
      if (res.op === "inspect") return { params: res.params, ...(res.error ? { error: res.error } : {}) };
      return { params: null, error: res.op === "run" && !res.result.ok ? res.result.error : { message: "Could not read params." } };
    },
    dispose() {
      for (const language of workers.keys()) kill(language, "Closed.");
    },
  };
}
