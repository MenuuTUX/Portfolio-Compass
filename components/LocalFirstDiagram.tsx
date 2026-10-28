"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import Reveal, { EASE, RevealGroup, RevealItem } from "./motion/Reveal";

const AUTOPLAY_MS = 4000;

const steps = [
  {
    label: "Market data",
    text: "Current quotes and fund facts come in.",
    lead: "Only ticker symbols go out.",
    bullets: [
      "Ticker symbols you look at are sent to fetch current quotes and fund facts.",
      "Your holdings, weights and share counts are not sent.",
    ],
  },
  {
    label: "Your browser",
    text: "Portfolio and recent tickers stay here.",
    lead: "Your portfolio is saved on this device.",
    bullets: [
      "Your working portfolio and recent tickers are saved in this browser's local storage.",
      "No account and no cookies.",
      "Clearing site data deletes them.",
    ],
  },
  {
    label: "Tools",
    text: "Compare, build and project from that set.",
    lead: "Every tool works from your saved set.",
    bullets: [
      "Compare, build and project run on that saved set.",
      "Results are model scenarios for research and education, not advice.",
    ],
  },
];

function Connector({ index, active, animate }: { index: number; active: number; animate: boolean }) {
  const reached = index < active;
  const travelling = animate && index === active - 1;
  const draw = { duration: animate ? 0.9 : 0, ease: EASE };

  const layers = (line: string, head: string, dot: { from: Record<string, number>; to: Record<string, number> }, cls: string) => (
    <>
      <path d={line} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className="text-muted" />
      <path d={head} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="text-muted" />
      <motion.path
        d={line}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        className="text-ink"
        initial={false}
        animate={{ pathLength: reached ? 1 : 0, opacity: reached ? 1 : 0 }}
        transition={draw}
      />
      <motion.path
        d={head}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="text-ink"
        initial={false}
        animate={{ opacity: reached ? 1 : 0 }}
        transition={{ duration: animate ? 0.2 : 0, delay: reached && animate ? 0.7 : 0 }}
      />
      {travelling && (
        <motion.circle
          key={active}
          r="3.5"
          className={cls}
          fill="currentColor"
          initial={{ ...dot.from, opacity: 0 }}
          animate={{ ...dot.to, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.9, ease: EASE, opacity: { duration: 0.9, times: [0, 0.1, 0.85, 1] } }}
        />
      )}
    </>
  );

  return (
    <>
      <svg viewBox="0 0 48 24" className="hidden h-6 w-12 md:block" fill="none" aria-hidden="true">
        {layers("M2 12 H44", "M40 8 L45 12 L40 16", { from: { cx: 3, cy: 12 }, to: { cx: 43, cy: 12 } }, "text-ink")}
      </svg>
      <svg viewBox="0 0 24 40" className="h-10 w-6 md:hidden" fill="none" aria-hidden="true">
        {layers("M12 2 V34", "M8 30 L12 35 L16 30", { from: { cx: 12, cy: 3 }, to: { cx: 12, cy: 33 } }, "text-ink")}
      </svg>
    </>
  );
}

export default function LocalFirstDiagram() {
  const [active, setActive] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inView = useInView(sectionRef, { amount: 0.3 });
  const reduced = useReducedMotion() ?? false;
  const playing = inView && !interacted && !reduced;

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % steps.length), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [playing, active]);

  const select = (i: number, focus = false) => {
    setInteracted(true);
    setActive(i);
    if (focus) tabRefs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = steps.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = active === last ? 0 : active + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = active === 0 ? last : active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    select(next, true);
  };

  const step = steps[active];

  return (
    <Reveal>
      <section
        ref={sectionRef}
        aria-labelledby="local-first-title"
        onPointerEnter={() => setInteracted(true)}
      >
        <h3
          id="local-first-title"
          className="font-display font-medium text-ink"
          style={{ fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.16, letterSpacing: "0.005em" }}
        >
          Your portfolio stays with you
        </h3>
        <p className="mt-4 max-w-[46ch] text-lg leading-relaxed text-body">
          Market data comes in. Your working portfolio and recent tickers stay in this browser. No account, no cookies. Storage: Browser only.
        </p>

        <div className="mt-6 flex gap-2" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.label} className="relative h-1 w-10 overflow-hidden rounded-full bg-hairline">
              <motion.span
                key={`${i}-${i === active ? playing : "x"}`}
                className="absolute inset-0 origin-left rounded-full bg-ink"
                initial={{ scaleX: i < active || (i === active && !playing) ? 1 : 0 }}
                animate={{ scaleX: i <= active ? 1 : 0 }}
                transition={i === active && playing ? { duration: AUTOPLAY_MS / 1000, ease: "linear" } : { duration: 0.25, ease: EASE }}
              />
            </span>
          ))}
        </div>

        <RevealGroup
          stagger={0.12}
          role="tablist"
          aria-label="Local-first workflow"
          onKeyDown={onKeyDown}
          onFocusCapture={() => setInteracted(true)}
          className="mt-8 grid items-center justify-items-center gap-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-3"
        >
          {steps.map((s, i) => {
            const selected = i === active;
            return [
              i > 0 && (
                <RevealItem key={`c${i}`} y={0} role="presentation" aria-hidden="true" className="flex items-center justify-center">
                  <Connector index={i - 1} active={active} animate={!reduced} />
                </RevealItem>
              ),
              <RevealItem key={s.label} role="presentation" className="w-full self-stretch">
                <motion.button
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`local-first-tab-${i}`}
                  aria-selected={selected}
                  aria-controls="local-first-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(i)}
                  animate={{ y: selected ? -4 : 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="relative block min-h-[44px] w-full cursor-pointer rounded-xl bg-surface-card p-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-compass focus-visible:ring-offset-2"
                >
                  {selected && (
                    <motion.span
                      layoutId="local-first-ring"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-ink"
                      transition={{ duration: 0.4, ease: EASE }}
                    />
                  )}
                  <span className="block text-xs text-muted tabular-nums">0{i + 1}</span>
                  <span className="mt-2 block text-base font-semibold text-ink">{s.label}</span>
                  <span className="mt-1 block text-sm text-body">{s.text}</span>
                </motion.button>
              </RevealItem>,
            ];
          })}
        </RevealGroup>

        <div
          role="tabpanel"
          id="local-first-panel"
          aria-labelledby={`local-first-tab-${active}`}
          tabIndex={0}
          className="mt-6 min-h-[11rem] rounded-xl bg-surface-soft p-6 outline-none focus-visible:ring-2 focus-visible:ring-compass md:min-h-[9.5rem]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <p className="text-base font-bold text-ink">{step.lead}</p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-body">
                {step.bullets.map((b) => (
                  <li key={b} className="flex gap-3">
                    <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </Reveal>
  );
}
