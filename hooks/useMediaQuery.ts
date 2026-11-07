import { useSyncExternalStore } from "react";

/** Tracks a CSS media query; false while rendering on the server. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** At the lg breakpoint (1024px) and up. */
export const useIsLg = () => useMediaQuery("(min-width: 1024px)");

/** Row sparkline shows from sm up and hides at lg+, where the full chart replaces it. */
export const useSparklineVisible = () => useMediaQuery("(min-width: 640px) and (max-width: 1023.98px)");
