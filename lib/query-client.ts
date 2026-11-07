import { QueryClient } from "@tanstack/react-query";

let browserClient: QueryClient | null = null;

/** One client for the whole tab, so the quiz and the app views share the same cache. */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return new QueryClient();
  browserClient ??= new QueryClient();
  return browserClient;
}

export const PORTFOLIO_QUERY_KEY = ["portfolio"] as const;
