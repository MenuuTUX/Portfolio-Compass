import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createStrategyClient } from "@/lib/lab/strategy/client";

// A fake strategy worker: the test decides what each request gets back.
class FakeWorker {
  static instances: FakeWorker[] = [];
  sent: { id: number; op: string }[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { preventDefault(): void }) => void) | null = null;
  terminated = false;
  constructor() { FakeWorker.instances.push(this); }
  postMessage(msg: { id: number; op: string }) { this.sent.push(msg); }
  terminate() { this.terminated = true; }
  reply(data: unknown) { this.onmessage?.({ data }); }
}

// Timers are recorded instead of run, so the test reads the limit each request was given.
type Armed = { id: number; ms: number; fn: () => void };
let armed: Armed[] = [];
let nextTimerId = 1;
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const realWorker = globalThis.Worker;

beforeEach(() => {
  FakeWorker.instances = [];
  armed = [];
  // @ts-expect-error test double
  globalThis.Worker = FakeWorker;
  // @ts-expect-error test double
  globalThis.setTimeout = (fn: () => void, ms = 0) => {
    const id = nextTimerId++;
    armed.push({ id, ms, fn });
    return id;
  };
  // @ts-expect-error test double
  globalThis.clearTimeout = (id: number) => {
    armed = armed.filter((t) => t.id !== id);
  };
});

afterEach(() => {
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
  globalThis.Worker = realWorker;
});

/** Sends one python run, answers it with `reply`, and returns the limit that run was given. */
async function pythonRunWith(client: ReturnType<typeof createStrategyClient>, reply: (id: number) => unknown) {
  const pending = client.run("python", "x", {}, [], "USD");
  const worker = FakeWorker.instances[FakeWorker.instances.length - 1];
  const id = worker.sent[worker.sent.length - 1].id;
  const limit = armed[armed.length - 1].ms;
  worker.reply(reply(id));
  await pending;
  return limit;
}

describe("strategy client time limit", () => {
  it("keeps the boot limit for the retry after Python failed to load", async () => {
    const client = createStrategyClient(() => {});
    const bootLimit = await pythonRunWith(client, (id) => ({
      id, op: "run", bootFailed: true,
      result: { ok: false, error: { message: "Python could not load: network" }, logs: [] },
    }));
    expect(bootLimit).toBe(120_000);
    const retryLimit = await pythonRunWith(client, (id) => ({ id, op: "run", result: { ok: true, weights: new Float64Array(), dates: [], tickers: [], logs: [], lookahead: { leaks: false, cutoffs: [] }, ms: 1 } }));
    expect(retryLimit).toBe(120_000);
  });

  it("uses the short limit once Python has loaded, even when the user's code failed", async () => {
    const client = createStrategyClient(() => {});
    await pythonRunWith(client, (id) => ({ id, op: "run", result: { ok: false, error: { message: "NameError", line: 3 }, logs: [] } }));
    const limit = await pythonRunWith(client, (id) => ({ id, op: "run", result: { ok: false, error: { message: "x" }, logs: [] } }));
    expect(limit).toBe(30_000);
  });

  it("says the stop may come from a slow strategy, not only an endless loop", async () => {
    const client = createStrategyClient(() => {});
    const pending = client.run("python", "x", {}, [], "USD");
    const timer = armed[armed.length - 1];
    timer.fn();
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result).toEqual({
      ok: false,
      error: {
        message: "Stopped after 120 s. This can be an endless loop, or a strategy that is slow on a long period; shorten the period or simplify the code.",
      },
      logs: [],
    });
  });
});
