"use client";

import { m as motion } from "framer-motion";
import type { ReactNode } from "react";
import LocalFirstDiagram from "./LocalFirstDiagram";
import BuildMock from "./landing/mocks/BuildMock";
import CompareMock from "./landing/mocks/CompareMock";
import TestMock from "./landing/mocks/TestMock";
import Reveal from "./motion/Reveal";
import { EASE } from "@/lib/motion";

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 4v12m0 0-5-5m5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SECTION_NAMES: Record<string, string> = { portfolio: "Portfolio", simulate: "Simulate", "your-data": "Your data" };

function Band({
  id,
  title,
  text,
  next,
  flip,
  children,
}: {
  id: string;
  title: ReactNode;
  text: string;
  next: string;
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto grid max-w-[88rem] items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16 lg:px-10">
        <Reveal className={flip ? "lg:order-2" : ""}>
          <h2 className="text-balance font-display font-medium text-ink" style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.16, letterSpacing: "0.005em" }}>
            {title}
          </h2>
          <p className="mt-6 max-w-[46ch] text-pretty text-lg leading-relaxed text-body">{text}</p>
          <motion.button
            type="button"
            onClick={() => scrollToId(next)}
            aria-label={`Continue to ${SECTION_NAMES[next]}`}
            className="ws-arrow-btn mt-8"
            whileHover={{ y: 4 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <ArrowIcon />
          </motion.button>
        </Reveal>
        <Reveal delay={0.1} className={flip ? "lg:order-1" : ""}>
          {children}
        </Reveal>
      </div>
    </section>
  );
}

interface PurposeSectionProps {
  onStart?: () => void;
  onViewMarket?: () => void;
}

export default function PurposeSection({ onStart, onViewMarket }: PurposeSectionProps) {
  return (
    <section id="tools" className="bg-canvas text-ink">
      <Band
        id="compare"
        title={<>Put funds and stocks side by side.</>}
        text="Search market data, compare holdings and see how fees, risk and return stack up."
        next="portfolio"
      >
        <CompareMock />
      </Band>

      <Band
        id="portfolio"
        title={<>Shape an allocation you can explain.</>}
        text="Start from a model mix or set your own split. In the app, the split becomes whole shares for the cash you have."
        next="simulate"
        flip
      >
        <BuildMock />
      </Band>

      <Band
        id="simulate"
        title={<>See its low, median and high case.</>}
        text="Monte Carlo paths drawn from your portfolio's own price history, over the years you pick. Results are model scenarios, not forecasts."
        next="your-data"
      >
        <TestMock />
      </Band>

      <div id="your-data" className="scroll-mt-20 py-16 sm:py-32">
        <div className="mx-auto max-w-[88rem] px-6 lg:px-10">
          <div className="rounded-3xl bg-surface-soft p-6 sm:p-12 lg:p-16">
            <LocalFirstDiagram />
          </div>

          <div className="mt-24 max-w-3xl sm:mt-32">
            <blockquote className="text-pretty font-display font-medium text-ink" style={{ fontSize: "clamp(24px, 3vw, 36px)", lineHeight: 1.25 }}>
              I wanted the portfolio math I kept rebuilding in spreadsheets:
              allocation checks, side-by-side comparisons, and model projections.
              I put them in one browser app and connected them to current market data.
            </blockquote>
            <p className="mt-4 text-sm text-muted">MenuuTUX, who built Portfolio Compass</p>
          </div>
        </div>
      </div>

      {/* The page ends on the two ways in, with the privacy promise beside them. */}
      <section id="start" aria-labelledby="start-title" className="scroll-mt-20 pt-8 sm:pt-16">
        <div className="mx-auto max-w-[88rem] px-6 lg:px-10">
          <Reveal className="border-t border-hairline pt-16 sm:pt-24">
            <h2
              id="start-title"
              className="max-w-[16ch] text-balance font-display font-bold text-ink"
              style={{ fontSize: "clamp(40px, 6vw, 88px)", lineHeight: 1.05, letterSpacing: "0.005em" }}
            >
              Your holdings stay in this browser.
            </h2>
            <p className="mt-6 max-w-[46ch] text-pretty text-lg leading-relaxed text-body">
              No account to make. Clearing this site&apos;s data deletes them.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button type="button" onClick={onStart} className="ws-btn-solid">
                Get started
              </button>
              <button type="button" onClick={onViewMarket} className="ws-btn-outline">
                Browse market
              </button>
            </div>
            <p className="mt-5 text-sm text-muted">For research and education, not financial advice.</p>
          </Reveal>
        </div>
      </section>
    </section>
  );
}
