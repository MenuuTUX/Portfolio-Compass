"use client";

import { useMotionValue, type MotionValue } from "framer-motion";
import { useEffect } from "react";

/** Viewport scroll position in px, from the landing scroll container (#top) or the window. */
export function useLandingScroll(): MotionValue<number> {
  const y = useMotionValue(0);
  useEffect(() => {
    const read = () => {
      const container = document.getElementById("top");
      y.set(Math.max(window.scrollY, container ? container.scrollTop : 0));
    };
    read();
    window.addEventListener("scroll", read, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", read, true);
  }, [y]);
  return y;
}
