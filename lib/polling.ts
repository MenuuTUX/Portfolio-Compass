/** How often a live quote view re-pulls while its tab is in view (the server caches quotes for 30s). */
export const QUOTE_REFRESH_MS = 60_000;

/** Calls `fn` every `ms` while the page is visible; returns the stop function. */
export function startVisibleInterval(fn: () => void, ms = QUOTE_REFRESH_MS): () => void {
  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") fn();
  }, ms);
  return () => window.clearInterval(timer);
}
