/**
 * Auth is not used.
 *
 * Portfolio Compass is local-first: holdings live in browser LocalStorage.
 * There is no login, OAuth, or cloud portfolio sync.
 */

export const AUTH_ENABLED = false;

export const AUTH_STATUS = {
  enabled: false,
  strategy: "local-first" as const,
  message:
    "No authentication. Portfolios persist in LocalStorage on this device only.",
};
