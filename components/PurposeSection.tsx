"use client";

import { motion, useReducedMotion, useTransform } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import LocalFirstDiagram from "./LocalFirstDiagram";
import { useElementProgress } from "./landing/PhoneMock";
import BuildMock from "./landing/mocks/BuildMock";
import CompareMock from "./landing/mocks/CompareMock";
import TestMock from "./landing/mocks/TestMock";
import Reveal, { EASE, RevealGroup, RevealItem } from "./motion/Reveal";

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h12m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const INDEX = [
  { label: "Compare", id: "compare" },
  { label: "Build", id: "build" },
  { label: "Test", id: "test" },
  { label: "Learn", id: "learn" },
];

function IndexWord({ id, label }: { id: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const progress = useElementProgress(ref);
  const opacity = useTransform(progress, [0.3, 0.5, 0.7], reduce ? [1, 1, 1] : [0.35, 1, 0.35]);
  return (
    <motion.div ref={ref} style={{ opacity }}>
      <button
        type="button"
        onClick={() => scrollToId(id)}
        className="block w-full cursor-pointer font-display font-bold text-ink transition-opacity duration-150 group-hover/index:opacity-30 hover:opacity-100!"
        style={{ fontSize: "clamp(48px, 9vw, 128px)", lineHeight: 1.1, letterSpacing: "0.005em" }}
      >
        {label}
      </button>
    </motion.div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={20} height={20} className="h-5 w-5 rounded-md" />
      <span className="text-sm font-medium text-ink">{children}</span>
    </div>
  );
}

function Band({
  id,
  eyebrow,
  title,
  text,
  next,
  flip,
  overlap,
  wide,
  tint,
  children,
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  text: string;
  next: string;
  flip?: boolean;
  /** Lets the mock poke above the tinted band. */
  overlap?: boolean;
  /** Gives the mock column more room than the text column. */
  wide?: boolean;
  /** Tailwind gradient classes for the tinted card. */
  tint: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const progress = useElementProgress(ref);
  const drift = useTransform(progress, [0, 1], reduce ? [0, 0] : [40, -40]);
  return (
    <section id={id} className="scroll-mt-20 py-16 sm:py-32">
      <div
        className={`mx-auto grid max-w-[88rem] items-center gap-12 px-6 lg:gap-16 lg:px-10 ${
          wide ? (flip ? "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]" : "lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]") : "lg:grid-cols-2"
        }`}
      >
        <Reveal className={flip ? "lg:order-2" : ""}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-6 font-display font-medium text-ink" style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.16, letterSpacing: "0.005em" }}>
            {title}
          </h2>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-body">{text}</p>
          <motion.button
            type="button"
            onClick={() => scrollToId(next)}
            aria-label={`Continue to ${next}`}
            className="ws-arrow-btn mt-8"
            whileHover={{ x: 4, rotate: -45 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <ArrowIcon />
          </motion.button>
        </Reveal>
        <Reveal delay={0.1} className={`rounded-3xl bg-surface-soft ${tint} p-6 sm:p-12 ${flip ? "lg:order-1" : ""}`}>
          <motion.div ref={ref} style={{ y: drift }}>
            <div className={overlap ? "sm:-mt-20" : ""}>{children}</div>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

export default function PurposeSection() {
  const [shareStatus, setShareStatus] = useState("");

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "PortfolioCompass", text: "PortfolioCompass: ETF comparison and portfolio tools", url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus("Link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Could not share the link. Copy the address from your browser.");
    }
  };

  return (
    <section id="tools" className="bg-canvas text-ink">
      <div className="mx-auto max-w-[88rem] px-6 py-24 text-center sm:py-40 lg:px-10">
        <Reveal><p className="text-sm font-medium text-muted">Portfolio tools in one browser tab</p></Reveal>
        <RevealGroup stagger={0.1} className="group/index mt-8">
          {INDEX.map((item) => (
            <RevealItem key={item.id} y={48} duration={0.9}>
              <IndexWord id={item.id} label={item.label} />
            </RevealItem>
          ))}
        </RevealGroup>
      </div>

      <Band
        id="compare"
        eyebrow="Compare"
        title={<>Put funds and stocks side by side.</>}
        text="Search market data, compare holdings and see how fees, risk and return stack up."
        next="build"
        tint="bg-[linear-gradient(135deg,rgba(224,184,74,0.12),rgba(182,165,230,0.16))]"
      >
        <CompareMock />
      </Band>

      <Band
        id="build"
        eyebrow="Build"
        title={<>Shape an allocation you can explain.</>}
        text="Start from a model portfolio or your own mix, then allocate whole shares under a cash limit."
        next="test"
        tint="bg-[linear-gradient(135deg,rgba(132,197,138,0.12),rgba(224,184,74,0.14))]"
        flip
        overlap
        wide
      >
        <BuildMock />
      </Band>

      <Band
        id="test"
        eyebrow="Test"
        title={<>Test what it assumes.</>}
        text="Run historical checks and Monte Carlo paths. Results are model scenarios based on past estimates, not forecasts."
        next="learn"
        tint="bg-[linear-gradient(135deg,rgba(182,165,230,0.16),rgba(229,112,63,0.10))]"
        overlap
        wide
      >
        <TestMock />
      </Band>

      <div id="learn" className="scroll-mt-20 py-16 sm:py-32">
        <div className="mx-auto max-w-[88rem] px-6 lg:px-10">
          <div className="rounded-3xl bg-surface-soft p-6 sm:p-12 lg:p-16">
            <LocalFirstDiagram />
          </div>

          <div className="mt-24 max-w-3xl sm:mt-32">
            <Eyebrow>Why this exists</Eyebrow>
            <blockquote className="mt-6 font-display font-medium tracking-tight text-ink" style={{ fontSize: "clamp(24px, 3vw, 36px)", lineHeight: 1.25 }}>
              I wanted the portfolio math I kept rebuilding in spreadsheets:
              allocation checks, side-by-side comparisons, and model projections.
              I put them in one browser app and connected them to current market data.
            </blockquote>
            <p className="mt-4 text-sm text-muted">Jim Cramer</p>
          </div>

          <div className="mt-24 border-t border-hairline pt-12 sm:mt-32">
            <h3 className="font-display font-medium tracking-tight text-ink" style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.16 }}>
              Support the project
            </h3>
            <p className="mt-4 max-w-[46ch] text-lg text-body">The code is open source. A GitHub star helps other people find the project.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="https://github.com/MenuuTUX/Portfolio-Compass" target="_blank" rel="noopener noreferrer" className="ws-btn-solid">
                Star on GitHub
              </a>
              <button onClick={share} className="ws-btn-outline">Share</button>
            </div>
            <p role="status" className="mt-4 text-sm text-body">{shareStatus}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
