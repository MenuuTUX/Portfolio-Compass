"use client";

import { m as motion, useMotionValue, type MotionValue } from "framer-motion";
import { useEffect, type ReactNode, type RefObject } from "react";
import { EASE } from "@/lib/motion";

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

/** 0 when the element's top meets the viewport bottom, 1 when its bottom leaves the top. */
export function useElementProgress(ref: RefObject<HTMLElement | null>): MotionValue<number> {
  const p = useMotionValue(0.5);
  useEffect(() => {
    const read = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      p.set(Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))));
    };
    read();
    window.addEventListener("scroll", read, { passive: true, capture: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read, true);
      window.removeEventListener("resize", read);
    };
  }, [ref, p]);
  return p;
}

function StatusGlyphs() {
  return (
    <span className="flex items-center gap-1 text-ink">
      <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden="true">
        <rect x="0" y="7" width="3" height="4" rx="0.8" />
        <rect x="4.6" y="5" width="3" height="6" rx="0.8" />
        <rect x="9.2" y="2.5" width="3" height="8.5" rx="0.8" />
        <rect x="13.8" y="0" width="3" height="11" rx="0.8" />
      </svg>
      <svg width="15" height="11" viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M1 3.8a9 9 0 0 1 13 0" />
        <path d="M3.4 6.3a5.6 5.6 0 0 1 8.2 0" />
        <circle cx="7.5" cy="9" r="0.9" fill="currentColor" stroke="none" />
      </svg>
      <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="21" height="11" rx="3.2" stroke="currentColor" opacity="0.4" />
        <rect x="2" y="2" width="18" height="8" rx="2" fill="currentColor" />
        <rect x="22.8" y="4" width="1.6" height="4" rx="0.8" fill="currentColor" opacity="0.5" />
      </svg>
    </span>
  );
}

function TabBar() {
  return (
    <div className="flex items-center justify-around border-t border-hairline px-5 pb-3.5 pt-3">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-ink" aria-hidden="true">
        <path d="M10 2.2 2.5 8.4V17a1 1 0 0 0 1 1H8v-5h4v5h4.5a1 1 0 0 0 1-1V8.4L10 2.2Z" />
      </svg>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-3.5 w-3.5 rounded-full bg-muted-soft/60" />
      ))}
    </div>
  );
}

/**
 * A realistic phone frame for product mocks: thin near-black bezel, dynamic island,
 * status bar and a tab bar. Decorative, so callers pass static content.
 */
export default function PhoneMock({
  children,
  tilt = -3,
  interactive = false,
  maxWidth = 300,
  screenHeight,
}: {
  children: ReactNode;
  /** Rotation in degrees. */
  tilt?: number;
  /** Real controls live on the screen: expose it to assistive tech and let it scroll. */
  interactive?: boolean;
  /** Frame width cap: px number or any CSS length. */
  maxWidth?: number | string;
  /** Fixed screen height: px number or any CSS length; the content scrolls inside it. */
  screenHeight?: number | string;
}) {
  return (
    <div
      className="relative mx-auto w-full rounded-[48px] bg-[#111] p-3 ring-1 ring-white/20 shadow-[0_40px_80px_rgba(0,0,0,0.28),0_12px_24px_rgba(0,0,0,0.14)]"
      style={{ transform: `rotate(${tilt}deg)`, maxWidth }}
      aria-hidden={interactive ? undefined : "true"}
    >
      <div
        className="relative flex min-h-[520px] flex-col overflow-hidden rounded-[38px] bg-surface-card"
        style={screenHeight ? { height: screenHeight } : undefined}
      >
        <div className="absolute left-1/2 top-2.5 z-10 h-[22px] w-[64px] -translate-x-1/2 rounded-full bg-[#111]" />
        <div className="flex items-center justify-between px-5 pb-1 pt-3.5 text-[12px] font-semibold leading-none text-ink">
          <span className="tabular-nums">9:41</span>
          <StatusGlyphs />
        </div>
        <div className={`flex-1 px-5 pb-4 pt-8 ${interactive ? "min-h-0 overflow-y-auto overscroll-contain ws-no-scrollbar" : ""}`}>{children}</div>
        <TabBar />
      </div>
    </div>
  );
}

/** Hero wrapper: slides up after the art starts, settles from a slight tilt, then floats. */
export function PhoneEntrance({ children, float = true }: { children: ReactNode; float?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotate: -3 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 1, delay: 0.9, ease: EASE }}
    >
      <motion.div
        animate={float ? { y: [0, -6, 0] } : undefined}
        transition={{ duration: 6, ease: "easeInOut", repeat: Infinity, delay: 0.9 + 1.2 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
