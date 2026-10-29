"use client";

import { motion, useMotionValue, type MotionValue } from "framer-motion";
import { useEffect, type ReactNode, type RefObject } from "react";
import CountUp from "../motion/CountUp";
import { EASE, RevealGroup, RevealItem } from "../motion/Reveal";

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
  className = "",
  tilt = -3,
  interactive = false,
  maxWidth = 300,
  screenHeight,
}: {
  children: ReactNode;
  className?: string;
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
      className={`relative mx-auto w-full rounded-[48px] bg-[#111] p-3 ring-1 ring-white/20 shadow-[0_40px_80px_rgba(0,0,0,0.28),0_12px_24px_rgba(0,0,0,0.14)] ${className}`}
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
export function PhoneEntrance({ children, delay = 0.9, float = true }: { children: ReactNode; delay?: number; float?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotate: -3 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 1, delay, ease: EASE }}
    >
      <motion.div
        animate={float ? { y: [0, -6, 0] } : undefined}
        transition={{ duration: 6, ease: "easeInOut", repeat: Infinity, delay: delay + 1.2 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

const CHART_POINTS = "0,52 14,48 28,50 42,38 56,42 70,30 84,34 98,22 112,26 126,14 140,16 154,6";
const usd = (v: number) => `$${Math.round(v).toLocaleString("en-CA")}`;

/** Static, illustrative home screen. Numbers are examples, not real data. */
export function PortfolioScreen({ compact = false, delay = 1.4 }: { compact?: boolean; delay?: number }) {
  return (
    <div>
      <p className="text-xs font-bold text-ink">Good morning</p>
      <p className="mt-4 text-[32px] font-bold leading-[38px] text-ink">
        <CountUp value={12480} format={usd} duration={1.6} />
      </p>
      <p className="mt-1 text-xs font-medium text-compass">+$2,480 (+24.8%) illustrative</p>
      <svg viewBox="0 0 154 60" className="mt-4 h-16 w-full" fill="none" preserveAspectRatio="none">
        <motion.polyline
          points={CHART_POINTS}
          stroke="var(--compass)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, delay, ease: EASE }}
        />
      </svg>
      <div className="mt-3 flex gap-1 text-xs font-medium text-muted">
        {["1M", "1Y", "5Y", "ALL"].map((r, i) => (
          <span key={r} className={`rounded-lg px-2 py-1 ${i === 3 ? "bg-surface-soft text-ink" : ""}`}>
            {r}
          </span>
        ))}
      </div>
      {!compact && (
        <ul className="mt-4 divide-y divide-hairline rounded-2xl bg-canvas px-3 ring-1 ring-hairline">
          {[
            ["VEQT", "All-equity ETF", "60%"],
            ["XBB", "Canadian bonds", "30%"],
            ["GLD", "Gold", "10%"],
          ].map(([ticker, name, weight]) => (
            <li key={ticker} className="flex items-center justify-between py-2.5">
              <span>
                <span className="block text-sm font-bold text-ink">{ticker}</span>
                <span className="block text-xs text-muted">{name}</span>
              </span>
              <span className="text-sm font-bold text-ink">{weight}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-center text-xs text-muted-soft">Example data</p>
    </div>
  );
}

/** Build band phone: static allocation screen. */
export function AllocationScreen() {
  const rows = [
    { label: "Equity", pct: 60, cls: "bg-ink" },
    { label: "Bonds", pct: 25, cls: "bg-muted" },
    { label: "Cash", pct: 10, cls: "bg-muted-soft" },
    { label: "Gold", pct: 5, cls: "bg-gold" },
  ];
  return (
    <RevealGroup>
      <RevealItem><p className="text-xs font-bold text-ink">Model allocation</p></RevealItem>
      <RevealItem>
        <div className="mt-4 flex h-24 items-end gap-2">
          {rows.map((r, i) => (
            <motion.div
              key={r.label}
              className={`flex-1 origin-bottom rounded-t-lg ${r.cls}`}
              style={{ height: `${r.pct * 1.5}%` }}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 + i * 0.08, ease: EASE }}
            />
          ))}
        </div>
      </RevealItem>
      <ul className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <RevealItem key={r.label}>
            <li className="flex items-center gap-2 text-xs">
              <span className={`h-2 w-2 rounded-full ${r.cls}`} />
              <span className="flex-1 text-body">{r.label}</span>
              <span className="font-bold text-ink tabular-nums">{r.pct}%</span>
            </li>
          </RevealItem>
        ))}
      </ul>
      <RevealItem><p className="mt-3 text-center text-xs text-muted-soft">Example data</p></RevealItem>
    </RevealGroup>
  );
}

/** Test band phone: static simulation paths screen. */
export function PathsScreen() {
  const paths = [
    { d: "M0 50 C20 44 40 38 60 30 S110 14 154 6", cls: "stroke-muted-soft", w: 1.2 },
    { d: "M0 50 C20 48 45 44 70 41 S115 33 154 30", cls: "stroke-ink", w: 2 },
    { d: "M0 50 C20 52 45 56 70 54 S115 57 154 56", cls: "stroke-muted-soft", w: 1.2 },
  ];
  return (
    <RevealGroup>
      <RevealItem><p className="text-xs font-bold text-ink">Simulated paths</p></RevealItem>
      <RevealItem><p className="mt-1 text-xs text-muted">1,000 runs, 20 years</p></RevealItem>
      <svg viewBox="0 0 154 60" className="mt-4 h-28 w-full" fill="none" preserveAspectRatio="none">
        {paths.map((p, i) => (
          <motion.path
            key={p.d}
            d={p.d}
            className={p.cls}
            strokeWidth={p.w}
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.2 + i * 0.15, ease: EASE }}
          />
        ))}
      </svg>
      <RevealItem>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          {["Low", "Median", "High"].map((l) => (
            <span key={l} className="rounded-lg bg-surface-soft py-1.5 font-medium text-body">{l}</span>
          ))}
        </div>
      </RevealItem>
      <RevealItem><p className="mt-3 text-center text-xs text-muted-soft">Model scenarios, not forecasts</p></RevealItem>
    </RevealGroup>
  );
}
