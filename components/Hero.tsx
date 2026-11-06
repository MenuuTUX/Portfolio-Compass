"use client";

import { m as motion, useReducedMotion, useTransform } from "framer-motion";
import Image from "next/image";
import BrushArt from "./landing/BrushArt";
import GrowthScreen from "./landing/GrowthScreen";
import Phone25D from "./landing/Phone25D";
import PhoneMock, { PhoneEntrance, useLandingScroll } from "./landing/PhoneMock";
import Reveal, { EASE } from "./motion/Reveal";
import { useEffect, useState } from "react";

const WIDE_QUERY = "(min-width: 900px)";
type HeroLayout = "unknown" | "wide" | "narrow";

/**
 * Server HTML renders both hero art trees (CSS hides one of them). After hydration
 * we keep only the visible one mounted, so hidden trees don't animate or hold state.
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
  { label: "Portfolio", id: "build" },
  { label: "Backtest", id: "test" },
  { label: "Learn", id: "learn" },
];

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h12m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const HEADLINE = ["Build a portfolio.", "Backtest what it", "assumes."];

export default function Hero({ onStart, onViewMarket }: HeroProps) {
  const [annualReturn, setAnnualReturn] = useState(7);
  const [years, setYears] = useState(10);
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
  const phoneY = useTransform(scrollY, [0, 900], [0, reduce ? 0 : -60]);
  const textY = useTransform(scrollY, [0, 900], [0, reduce ? 0 : -30]);
  const textOpacity = useTransform(scrollY, [0, 900], [1, reduce ? 1 : 0.2]);

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
          <span className="whitespace-nowrap text-base font-semibold tracking-tight max-[359px]:hidden">Portfolio Compass</span>
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

      <div className="@container relative mx-auto w-full max-w-[88rem] px-6 pt-32 pb-24 sm:pt-40 sm:pb-32 lg:px-10 min-[900px]:min-h-[860px]">
        <div
          className="pointer-events-none absolute inset-y-0 -inset-x-1/4 -z-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(40% 55% at 69% 38%, rgba(182,165,230,0.16), transparent 70%), radial-gradient(30% 45% at 78% 20%, rgba(224,184,74,0.14), transparent 70%), radial-gradient(27% 40% at 58% 70%, rgba(132,197,138,0.12), transparent 70%)",
          }}
        />
        {layout !== "narrow" && (
          <motion.div
            className="pointer-events-none absolute top-16 z-10 hidden w-[50%] max-w-[52rem] min-[900px]:block"
            style={{ y: artY, right: "-4%" }}
          >
            <BrushArt className="w-full" />
            <motion.div className="pointer-events-auto absolute left-[12%] top-[6%] w-[74%]" style={{ y: phoneY }}>
              <PhoneEntrance float={false}>
                <Phone25D maxWidth="clamp(300px, 24cqw, 420px)">
                  <PhoneMock interactive tilt={0} maxWidth="clamp(300px, 24cqw, 420px)" screenHeight="clamp(520px, 74vh, 700px)">
                    <GrowthScreen idPrefix="growth-wide" years={years} annualReturn={annualReturn} onYears={setYears} onReturn={setAnnualReturn} />
                  </PhoneMock>
                </Phone25D>
              </PhoneEntrance>
            </motion.div>
          </motion.div>
        )}
        <motion.div className="relative min-[900px]:max-w-[50%]" style={{ y: textY, opacity: textOpacity }}>
        {/* Entrances are CSS animations, not framer initial states, so the server HTML is already visible. */}
        <div className="animate-ws-fade-up flex items-center gap-2">
          <Image src="/logo.png" alt="" width={20} height={20} sizes="20px" className="h-5 w-5 rounded-md" />
          <span className="text-sm font-medium text-ink">Portfolio Compass</span>
        </div>
        <h1
          id="landing-title"
          className="mt-6 max-w-5xl font-display font-bold text-ink text-[clamp(40px,11vw,64px)] min-[900px]:text-[clamp(40px,5.2cqw,112px)]"
          style={{ lineHeight: 1.05, letterSpacing: "0.005em" }}
        >
          {HEADLINE.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
              <span className="ws-rise block" style={{ animationDelay: `${i * 70}ms` }}>
                {line}
              </span>
            </span>
          ))}
        </h1>
        <div className="animate-ws-fade-up mt-8 max-w-[46ch]" style={{ animationDelay: "120ms" }}>
          <p className="text-lg leading-relaxed text-body">
            Compare funds and stocks, then test an allocation against historical data and simulated paths.
          </p>
        </div>
        <div className="animate-ws-fade-up mt-10 flex items-center gap-3" style={{ animationDelay: "180ms" }}>
          <button type="button" onClick={onStart} className="ws-btn-solid">
            Get started
          </button>
          <button type="button" onClick={onViewMarket} aria-label="Browse market" className="ws-arrow-btn">
            <ArrowIcon />
          </button>
        </div>
        <div className="animate-ws-fade-up" style={{ animationDelay: "240ms" }}>
          <p className="mt-5 text-sm text-muted">For research and education, not financial advice.</p>
        </div>
        </motion.div>

        {layout !== "wide" && (
          <Reveal className="relative mt-14 min-[900px]:hidden">
            <PhoneMock interactive tilt={0} maxWidth={360} screenHeight={640}>
              <GrowthScreen idPrefix="growth-sm" years={years} annualReturn={annualReturn} onYears={setYears} onReturn={setAnnualReturn} />
            </PhoneMock>
          </Reveal>
        )}
      </div>
    </section>
  );
}
