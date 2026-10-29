import type { Frame } from "@/lib/lab/engine/frame";

// A run's identity: engine version, settings, strategy and the exact numbers
// the engine saw. Rerunning anything with the same hash must give the same
// result; if it does not, the engine has a bug.

export const ENGINE_VERSION = "lab-engine/0.1.0";

/** JSON with object keys sorted, so equal values always serialize the same way. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v) && !ArrayBuffer.isView(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export async function runHash(
  frame: Frame,
  settings: unknown,
  strategy: { code: string; params?: unknown },
): Promise<string> {
  const header = new TextEncoder().encode(
    canonical({ engine: ENGINE_VERSION, settings, strategy, dates: frame.dates, tickers: frame.tickers, currency: frame.currency }),
  );
  const arrays = [frame.open, frame.close, frame.adjClose, frame.dividend];
  const size = header.byteLength + arrays.reduce((n, a) => n + a.byteLength, 0);
  const bytes = new Uint8Array(size);
  bytes.set(header, 0);
  let offset = header.byteLength;
  for (const a of arrays) {
    bytes.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), offset);
    offset += a.byteLength;
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
