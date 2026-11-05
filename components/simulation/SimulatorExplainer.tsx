"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Activity,
  Calculator,
  ArrowRight,
  Shuffle,
  GitBranch,
  Binary,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/components/motion/Reveal";

interface SimulatorExplainerProps {
  mode?: "SIMPLE" | "MONTE_CARLO";
}

const steps = [
  {
    id: "simple",
    title: "Deterministic Growth",
    subtitle: "Compound Interest Model",
    icon: TrendingUp,
    description:
      "The simple projection compounds a constant annual return, converted to a monthly rate, with a contribution at the start of each month. It shows how those assumptions accumulate over time; it does not model market volatility.",
    details: [
      {
        label: "Total Return",
        text: "A single annual return assumption",
        icon: Calculator,
      },
      {
        label: "All Assets",
        text: "Starting balance plus regular contributions",
        icon: ArrowRight,
      },
      {
        label: "No Volatility",
        text: "Does not model changes in return",
        icon: Activity,
      },
    ],
  },
  {
    id: "monte_carlo",
    title: "Stochastic Simulation",
    subtitle: "Reshuffle, Resample, Randomize",
    icon: GitBranch,
    description:
      "The Monte Carlo model generates illustrative paths from at least 200 aligned daily returns in three ways. Reshuffle replays the past year's days in a random order, so every path ends at the same value and only the route changes. Resample picks past days at random with repeats, so endings differ. Randomize draws returns from geometric Brownian motion fitted to the same history. Returns come from dividend-adjusted closes (total return) when every holding has them, and from price alone otherwise, with the basis shown after each run. Percentiles are not calibrated probabilities or forecasts.",
    details: [
      {
        label: "Reshuffle",
        text: "Same days, new order: shows sequence risk",
        icon: Shuffle,
      },
      {
        label: "Resample",
        text: "Real days drawn with repeats, optionally in blocks",
        icon: ArrowRight,
      },
      {
        label: "Randomize",
        text: "Drift (μ), volatility (σ) and sample covariance, no separate yield term",
        icon: Binary,
      },
    ],
  },
];

export default function SimulatorExplainer({
  mode = "SIMPLE",
}: SimulatorExplainerProps) {
  const [activeStep, setActiveStep] = useState(mode === "MONTE_CARLO" ? 1 : 0);
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  // Sync active step if mode prop changes (adjust-state-during-render pattern,
  // avoids the extra render an effect would cause)
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setActiveStep(mode === "MONTE_CARLO" ? 1 : 0);
  }

  const term = (id: string, label: React.ReactNode, className?: string) => (
    <span
      tabIndex={0}
      className={cn(
        "cursor-help rounded-sm transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-compass",
        hoveredTerm === id ? "text-ink" : "text-body",
        className,
      )}
      onMouseEnter={() => setHoveredTerm(id)}
      onMouseLeave={() => setHoveredTerm(null)}
      onFocus={() => setHoveredTerm(id)}
      onBlur={() => setHoveredTerm(null)}
    >
      {label}
    </span>
  );

  return (
    <div className="@container w-full mt-8 mb-8 relative">
      <div className="ws-panel overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-hairline p-4 @2xl:p-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-ink">
            <Binary className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">How the projection works</h2>
            <p className="text-sm text-muted">Review the assumptions and equations behind each chart.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 @4xl:grid-cols-12">
          {/* Illustration */}
          <div className="@4xl:col-span-7 flex items-center justify-center border-b border-hairline p-4 @lg:p-8 @4xl:border-b-0 @4xl:border-r @4xl:p-12">
            <AnimatePresence mode="wait">
              {activeStep === 0 && (
                <motion.div
                  key="step-0"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="flex w-full flex-col items-center gap-8"
                >
                  <div className="relative w-full max-w-md">
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3 rounded-lg bg-surface-soft px-4 py-5 text-xl text-ink @lg:text-2xl">
                      {term("A", "FV", "font-semibold text-ink")}
                      <span className="text-muted">=</span>
                      <span className="whitespace-nowrap">
                        {term("P", <>P(1+i)<sup className="text-sm">n</sup></>)}
                      </span>
                      <span className="text-muted">+</span>
                      <span className="inline-flex items-center gap-2">
                        {term("PMT", "PMT")}
                        <span className="text-muted">×</span>
                        <span className="inline-flex flex-col items-center text-base">
                          <span className="border-b border-hairline-strong px-1 pb-0.5">
                            (1+i)<sup className="text-xs">n</sup> − 1
                          </span>
                          <span>i</span>
                        </span>
                        <span className="text-muted">×</span>
                        {term("due", "(1+i)")}
                      </span>
                    </div>
                    <p className="mt-3 min-h-10 text-center text-sm text-muted" aria-live="polite">
                      {hoveredTerm === "A" && "FV, future value: the balance after n = 12 × years months."}
                      {hoveredTerm === "P" && "P, the starting balance, compounded monthly at i = (1 + r)^(1/12) − 1, the monthly rate equal to an annual return r."}
                      {hoveredTerm === "PMT" && "PMT, the monthly contribution."}
                      {hoveredTerm === "due" && "Contributions go in at the start of each month, so each one earns that month's return."}
                      {!hoveredTerm && "Hover or focus a term to see what it means."}
                    </p>
                  </div>

                  <figure className="w-full max-w-sm rounded-lg bg-surface-soft p-4">
                    <figcaption className="mb-2 flex items-center justify-between text-xs text-muted">
                      <span>Constant-return path</span>
                      <span>Deterministic</span>
                    </figcaption>
                    <svg className="h-28 w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="A smooth upward curve with no ups and downs">
                      <path d="M0,100 Q50,60 100,10" fill="none" stroke="var(--ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </figure>
                </motion.div>
              )}

              {activeStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="flex w-full flex-col items-center gap-8"
                >
                  <div className="relative w-full max-w-md">
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3 rounded-lg bg-surface-soft px-4 py-5 text-xl text-ink @lg:text-2xl">
                      <span>dS</span>
                      <span className="text-muted">=</span>
                      {term("drift", "μS dt", "underline decoration-2 underline-offset-8")}
                      <span className="text-muted">+</span>
                      {term("shock", "σS dW", "underline decoration-dashed decoration-2 underline-offset-8")}
                    </div>
                    <p className="mt-3 min-h-10 text-center text-sm text-muted" aria-live="polite">
                      {hoveredTerm === "drift" && "Drift (solid underline): μ, set from the mean daily log return, which already nets out the volatility drag (σ²/2). So the median path follows μ, and the average path sits above it."}
                      {hoveredTerm === "shock" && "Random shock (dashed underline): daily price noise scaled by volatility, σ."}
                      {!hoveredTerm && "Hover or focus a term to see what it means."}
                    </p>
                  </div>

                  <figure className="w-full max-w-sm rounded-lg bg-surface-soft p-4">
                    <figcaption className="mb-2 flex items-center justify-between text-xs text-muted">
                      <span>Simulated paths</span>
                      <span>Assumption-based, not a forecast</span>
                    </figcaption>
                    <svg className="h-28 w-full overflow-visible" viewBox="0 0 100 115" preserveAspectRatio="none" role="img" aria-label="Several jagged paths, most rising and one falling">
                      <g fill="none" stroke="var(--ink)" strokeOpacity="0.45" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
                        <path vectorEffect="non-scaling-stroke" d="M0,100 L10,90 L20,95 L30,80 L40,85 L50,70 L60,75 L70,60 L80,65 L90,50 L100,55" />
                        <path vectorEffect="non-scaling-stroke" d="M0,100 L10,95 L20,85 L30,90 L40,75 L50,80 L60,65 L70,70 L80,55 L90,60 L100,45" />
                        <path vectorEffect="non-scaling-stroke" d="M0,100 L10,98 L20,92 L30,85 L40,90 L50,82 L60,70 L70,75 L80,68 L90,55 L100,40" />
                      </g>
                      <path vectorEffect="non-scaling-stroke" d="M0,100 L20,105 L40,110 L60,100 L80,105 L100,95" fill="none" stroke="var(--loss)" strokeWidth="1.5" strokeDasharray="3 3" />
                    </svg>
                    <p className="mt-2 text-xs text-muted">The red dashed path shows a loss: paths can end below where they started.</p>
                  </figure>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Steps */}
          <div className="@4xl:col-span-5 flex flex-col">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === index;

              return (
                <button
                  type="button"
                  key={step.id}
                  aria-pressed={isActive}
                  onClick={() => setActiveStep(index)}
                  className={cn(
                    "text-left p-4 @lg:p-6 border-b border-hairline last:border-b-0 transition-colors duration-75 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-compass",
                    isActive ? "bg-surface-soft/60" : "hover:bg-surface-soft/40",
                  )}
                >
                  <div className="flex gap-3 @lg:gap-4">
                    <div
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        isActive ? "bg-surface-soft text-ink" : "bg-surface-soft/60 text-muted",
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={cn("text-base font-semibold", isActive ? "text-ink" : "text-body")}>{step.title}</h3>
                        <ChevronRight
                          className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-200", isActive && "rotate-90")}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="text-sm text-muted">{step.subtitle}</p>
                      <p className="mt-2 text-sm leading-6 text-body">{step.description}</p>

                      <AnimatePresence initial={false}>
                        {isActive && (
                          <motion.ul
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.28, ease: EASE }}
                            className="overflow-hidden"
                          >
                            {step.details.map((detail) => (
                              <li key={detail.label} className="mt-3 flex items-start gap-3 first:mt-4">
                                <detail.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                                <div>
                                  <div className="text-sm font-medium text-ink">{detail.label}</div>
                                  <div className="text-sm text-muted">{detail.text}</div>
                                </div>
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
