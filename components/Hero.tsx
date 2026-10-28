"use client";

import { motion, useReducedMotion, useTransform } from "framer-motion";
import BrushArt from "./landing/BrushArt";
import GrowthScreen from "./landing/GrowthScreen";
import Phone25D from "./landing/Phone25D";
import PhoneMock, { PhoneEntrance, useLandingScroll } from "./landing/PhoneMock";
import Reveal, { EASE } from "./motion/Reveal";
import { useEffect, useState } from "react";

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
  { label: "Learn", id: "learn" },
];

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h12m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const HEADLINE = ["Build a portfolio.", "Test what it", "assumes."];

export default function Hero({ onStart, onViewMarket }: HeroProps) {
  const [annualReturn, setAnnualReturn] = useState(7);
  const [years, setYears] = useState(10);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
        initial={{ opacity: 0, y: -24 }}
        animate={{
          opacity: 1,
          y: 0,
          boxShadow: scrolled ? "0 8px 28px rgba(0,0,0,0.16)" : "0 2px 8px rgba(0,0,0,0.06)",
        }}
        transition={{ duration: 0.7, ease: EASE }}
        style={scrolled ? { backgroundColor: "var(--color-surface-card)", backdropFilter: "none" } : undefined}
      >
        <div className="flex flex-1 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
          <span className="text-base font-semibold ">PortfolioCompass</span>
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
        <motion.div className="relative min-[900px]:max-w-[50%]" style={{ y: textY, opacity: textOpacity }}>
        <Reveal onMount y={12} className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={20} height={20} className="h-5 w-5 rounded-md" />
          <span className="text-sm font-medium text-ink">PortfolioCompass</span>
        </Reveal>
        <h1
          id="landing-title"
          className="mt-6 max-w-5xl font-display font-bold text-ink text-[clamp(40px,11vw,64px)] min-[900px]:text-[clamp(40px,5.2cqw,112px)]"
          style={{ lineHeight: 1.05, letterSpacing: "0.005em" }}
        >
          {HEADLINE.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
              <motion.span
                className="block"
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.9, delay: 0.15 + i * 0.08, ease: EASE }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>
        <Reveal onMount delay={0.6} className="mt-8 max-w-[46ch]">
          <p className="text-lg leading-relaxed text-body">
            Compare funds and stocks, then test an allocation against historical data and simulated paths.
          </p>
        </Reveal>
        <Reveal onMount delay={0.72} className="mt-10 flex items-center gap-3">
          <button type="button" onClick={onStart} className="ws-btn-solid">
            Get started
          </button>
          <button type="button" onClick={onViewMarket} aria-label="Browse market" className="ws-arrow-btn">
            <ArrowIcon />
          </button>
        </Reveal>
        <Reveal onMount delay={0.84} y={12}>
          <p className="mt-5 text-sm text-muted">For research and education, not financial advice.</p>
        </Reveal>
        </motion.div>

        <Reveal className="relative mt-14 min-[900px]:hidden">
          <PhoneMock interactive tilt={0} maxWidth={360} screenHeight={640}>
            <GrowthScreen idPrefix="growth-sm" years={years} annualReturn={annualReturn} onYears={setYears} onReturn={setAnnualReturn} />
          </PhoneMock>
        </Reveal>
      </div>
    </section>
  );
}
