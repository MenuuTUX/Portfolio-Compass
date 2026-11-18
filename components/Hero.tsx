"use client";

import { m as motion, useReducedMotion, useTransform } from "framer-motion";
import Image from "next/image";
import BrushArt from "./landing/BrushArt";
import HeroCompare from "./landing/HeroCompare";
import { useLandingScroll } from "./landing/scroll";
import { EASE } from "@/lib/motion";
import { useEffect, useState } from "react";

const WIDE_QUERY = "(min-width: 900px)";
type HeroLayout = "unknown" | "wide" | "narrow";

/**
 * The painted arch only shows on wide screens. Server HTML renders it (CSS hides it on
 * narrow screens); after hydration it stays mounted only where it is visible.
 */
function useHeroLayout(): HeroLayout {
  const [layout, setLayout] = useState<HeroLayout>("unknown");
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(WIDE_QUERY);
    const apply = () => setLayout(mq.matches ? "wide" : "narrow");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return layout;
}

interface HeroProps {
  onStart?: () => void;
  onViewMarket?: () => void;
}

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const NAV_LINKS = [
  { label: "Compare", id: "compare" },
  { label: "Portfolio", id: "portfolio" },
  { label: "Simulate", id: "simulate" },
  { label: "Your data", id: "your-data" },
];

const HEADLINE = ["You opened a TFSA.", "Now compare what", "goes in it."];

export default function Hero({ onStart, onViewMarket }: HeroProps) {
  const [scrolled, setScrolled] = useState(false);
  const layout = useHeroLayout();
  useEffect(() => {
    // The landing scrolls inside #top, so the header must listen there, not on window.
    const scroller = document.getElementById("top");
    const target: EventTarget = scroller ?? window;
    const onScroll = () => {
      const y = Math.max(window.scrollY, scroller ? scroller.scrollTop : 0);
      setScrolled(y > 24);
    };
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);
  const scrollY = useLandingScroll();
  const reduce = useReducedMotion();
  const artY = useTransform(scrollY, [0, 900], [0, reduce ? 0 : -80]);
  const textY = useTransform(scrollY, [0, 900], [0, reduce ? 0 : -30]);

  return (
    <section className="overflow-x-clip bg-canvas text-ink selection:bg-compass/20" aria-labelledby="landing-title">
      <motion.header
        className="ws-nav"
        initial={false}
        animate={{
          boxShadow: scrolled ? "0 8px 28px rgba(0,0,0,0.16)" : "0 2px 8px rgba(0,0,0,0.06)",
        }}
        transition={{ duration: 0.7, ease: EASE }}
        style={scrolled ? { backgroundColor: "var(--color-surface-card)", backdropFilter: "none" } : undefined}
      >
        <div className="flex flex-1 items-center gap-2.5">
          <Image src="/logo.png" alt="" width={28} height={28} sizes="28px" className="h-7 w-7 rounded-lg" />
          <span className="whitespace-nowrap text-base font-semibold max-[359px]:hidden">Portfolio Compass</span>
        </div>
        <nav aria-label="Landing sections" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => scrollToId(link.id)}
              className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium text-ink transition-opacity duration-[70ms] hover:opacity-60 cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </nav>
        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="hidden sm:block">
            <button type="button" onClick={onViewMarket} className="ws-btn-outline">
              Browse market
            </button>
          </div>
          <button type="button" onClick={onStart} className="ws-btn-solid">
            Get started
          </button>
        </div>
      </motion.header>

      <div className="@container relative mx-auto grid w-full max-w-[88rem] gap-14 px-6 pt-32 pb-24 sm:pt-40 sm:pb-32 lg:px-10 min-[900px]:grid-cols-2 min-[900px]:items-start min-[900px]:gap-12">
        {/* Top-aligned and level with the comparison, so opening its assumptions never moves the headline. */}
        <motion.div className="relative min-[900px]:pt-36" style={{ y: textY }}>
        {/* Entrances are CSS animations, not framer initial states, so the server HTML is already visible. */}
        <h1
          id="landing-title"
          className="max-w-5xl text-balance font-display font-bold text-ink text-[clamp(40px,11vw,64px)] min-[900px]:text-[clamp(40px,4.9cqw,104px)]"
          style={{ lineHeight: 1.05, letterSpacing: "0.005em" }}
        >
          {/* Hand-set lines that rise in on wide screens; on narrow screens the words flow and balance instead. */}
          {HEADLINE.map((line, i) => (
            <span key={line} className="min-[900px]:block min-[900px]:overflow-hidden min-[900px]:pb-[0.12em] min-[900px]:-mb-[0.12em]">
              <span className="ws-rise min-[900px]:block" style={{ animationDelay: `${i * 70}ms` }}>
                {line}
              </span>{" "}
            </span>
          ))}
        </h1>
        <div className="animate-ws-fade-up mt-8 max-w-[46ch]" style={{ animationDelay: "120ms" }}>
          <p className="text-pretty text-lg leading-relaxed text-body">
            Put funds side by side with what each number assumes, then build a portfolio and simulate a range of outcomes from its own price history.
          </p>
        </div>
        <div className="animate-ws-fade-up mt-10 flex flex-wrap items-center gap-3" style={{ animationDelay: "180ms" }}>
          <button type="button" onClick={onStart} className="ws-btn-solid">
            Get started
          </button>
          <button type="button" onClick={onViewMarket} className="ws-btn-outline">
            Browse market
          </button>
        </div>
        <div className="animate-ws-fade-up" style={{ animationDelay: "240ms" }}>
          <p className="mt-5 text-sm text-muted">For research and education, not financial advice.</p>
        </div>
        </motion.div>

        {/* On wide screens the arch rises above the comparison, so the column leaves room on top. */}
        <div className="relative min-[900px]:pt-36">
          {layout !== "narrow" && (
            <motion.div
              className="pointer-events-none absolute -top-8 left-[4%] hidden w-[92%] min-[900px]:block"
              style={{ y: artY }}
            >
              <BrushArt className="w-full" />
            </motion.div>
          )}
          <div className="animate-ws-fade-up relative" style={{ animationDelay: "160ms" }}>
            <HeroCompare />
          </div>
        </div>
      </div>
    </section>
  );
}
