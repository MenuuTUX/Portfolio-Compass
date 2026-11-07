// Limits for calls to outside providers (Yahoo, stockanalysis, etf.com, CNN).
// Without a timeout, one hung connection holds a serverless function until the
// platform kills it, and every request that joins it waits too.

/** Longest a single provider request may take. */
export const UPSTREAM_TIMEOUT_MS = 8_000;

export const timeoutSignal = (ms: number = UPSTREAM_TIMEOUT_MS): AbortSignal => AbortSignal.timeout(ms);

/**
 * `fetch` that gives up after the upstream timeout unless the caller brought
 * its own signal. Passed to yahoo-finance2 so every Yahoo call is bounded.
 * `fetch` is looked up at call time so tests and Next's patched fetch still apply.
 */
export const fetchWithTimeout = ((input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, signal: init?.signal ?? timeoutSignal() })) as typeof fetch; // SAFETY: Bun's `typeof fetch` also lists `preconnect`, which yahoo-finance2 never calls.
