"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  TrendingUp,
  ShieldCheck,
  Scale,
  ArrowRight,
  Zap,
  Target,
  Lock,
  Calculator,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: "objective",
    title: "Objective Function",
    subtitle: "Scoring candidate allocations",
    icon: Target,
    color: "emerald",
    description:
      "The score subtracts a variance penalty from a return proxy. The optimizer searches for whole-share purchases that improve that score; it does not test every possible portfolio.",
    details: [
      {
        label: "Return Proxy (μ)",
        text: "Dividend yield plus beta multiplied by 6%",
        icon: TrendingUp,
      },
      {
        label: "Variance Proxy (Σ)",
        text: "Annual covariance from aligned history, with a beta-based fallback",
        icon: ShieldCheck,
      },
      {
        label: "Penalty (λ)",
        text: "Selected by the Conservative, Balanced, or Growth setting",
        icon: Lock,
      },
    ],
  },
  {
    id: "process",
    title: "Iterative Selection",
    subtitle: "Choose the next share batch",
    icon: BrainCircuit,
    color: "blue",
    description:
      "Finding the theoretical maximum for integer-constrained portfolios is computationally expensive. We use a greedy heuristic that simulates buying small batches of shares and picks the one that improves the score the most.",
    details: [
      {
        label: "Simulation",
        text: "Test adding capital to each asset",
        icon: Zap,
      },
      {
        label: "Marginal Utility",
        text: "Calculate the change in the utility score",
        icon: Scale,
      },
      {
        label: "Selection",
        text: "Buy the candidate with the largest score increase",
        icon: ArrowRight,
      },
    ],
  },
  {
    id: "constraint",
    title: "Constraints",
    subtitle: "Practical limitations",
    icon: Lock,
    color: "rose",
    description:
      "Continuous-weight portfolio models can assign fractional positions. This implementation works with whole shares, an explicit cash budget, and existing holdings.",
    details: [
      {
        label: "Integer Shares",
        text: "No fractional share assumptions",
        icon: Target,
      },
      {
        label: "Budget",
        text: "Purchases cannot exceed available cash",
        icon: Scale,
      },
      {
        label: "Rebalancing",
        text: "Scores new purchases alongside existing holdings",
        icon: TrendingUp,
      },
    ],
  },
];

export default function AlgorithmExplainer() {
  const [activeStep, setActiveStep] = useState(0);
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  // Interactive State for Step 1
  const [lambda, setLambda] = useState(2.0); // Risk Aversion

  // Interactive State for Step 2
  const [simulationState, setSimulationState] = useState<
    "IDLE" | "SIMULATING" | "CALCULATING" | "SELECTED"
  >("IDLE");

  const runSimulation = () => {
    setSimulationState("SIMULATING");
    setTimeout(() => setSimulationState("CALCULATING"), 1500);
    setTimeout(() => setSimulationState("SELECTED"), 3500);
  };

  const resetSimulation = () => {
    setSimulationState("IDLE");
  };

  return (
    <div className="w-full max-w-7xl mx-auto mt-12 mb-24 relative font-sans">
      {/* Ambient Background */}

      <div className="relative glass-panel border border-hairline bg-dune/30 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-8 border-b border-hairline flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <BrainCircuit className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-ink tracking-tight">
                Allocation Heuristic
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-body">
              This experimental, whole-share allocator uses a greedy search to
              improve a return proxy minus a variance penalty. It uses
              historical covariance when enough data overlaps, with a
              beta-based fallback. It does not guarantee the best possible
              allocation.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 bg-surface-card px-3 py-1.5 rounded-full border border-hairline">
            <Calculator className="w-3 h-3" />
            <span>GREEDY HEURISTIC</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-[600px]">
          {/* LEFT: Interactive Visualizer (7 Columns) */}
          <div className="lg:col-span-7 bg-black/5 relative overflow-hidden flex flex-col border-r border-hairline">
            {/* Background Grid */}

            {/* Content Area */}
            <div className="flex-1 p-8 lg:p-12 flex items-center justify-center relative w-full">
              <AnimatePresence mode="wait">
                {/* === STEP 1: OBJECTIVE FUNCTION === */}
                {activeStep === 0 && (
                  <motion.div
                    key="step-0"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.4 }}
                    className="w-full flex flex-col items-center gap-10"
                  >
                    {/* The Equation */}
                    <div className="relative">
                      <div className="relative bg-dune/50 border border-hairline px-10 py-8 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-4 text-3xl md:text-4xl font-serif text-white">
                        <span
                          className={cn(
                            "transition-colors cursor-help italic font-bold",
                            hoveredTerm === "U"
                              ? "text-ink"
                              : "text-ink",
                          )}
                          onMouseEnter={() => setHoveredTerm("U")}
                          onMouseLeave={() => setHoveredTerm(null)}
                        >
                          U
                        </span>
                        <span className="text-neutral-600 text-2xl mx-1">
                          =
                        </span>
                        <div className="flex items-center group/return">
                          <span
                            className={cn(
                              "transition-colors cursor-help italic",
                              hoveredTerm === "mu"
                                ? "text-muted"
                                : "text-neutral-200",
                            )}
                            onMouseEnter={() => setHoveredTerm("mu")}
                            onMouseLeave={() => setHoveredTerm(null)}
                          >
                            w<sup className="text-lg">T</sup>μ
                          </span>
                        </div>
                        <span className="text-neutral-600 text-2xl mx-2">
                          -
                        </span>
                        <div className="flex items-center group/risk">
                          <span
                            className={cn(
                              "transition-colors cursor-help italic font-bold",
                              hoveredTerm === "lambda"
                                ? "text-ink scale-110"
                                : "text-ink",
                            )}
                            onMouseEnter={() => setHoveredTerm("lambda")}
                            onMouseLeave={() => setHoveredTerm(null)}
                          >
                            λ
                          </span>
                          <span
                            className={cn(
                              "ml-3 transition-colors cursor-help italic",
                              hoveredTerm === "sigma"
                                ? "text-ink"
                                : "text-neutral-200",
                            )}
                            onMouseEnter={() => setHoveredTerm("sigma")}
                            onMouseLeave={() => setHoveredTerm(null)}
                          >
                            w<sup className="text-lg">T</sup>Σw
                          </span>
                        </div>
                      </div>

                      {/* Floating Tooltip */}
                      <AnimatePresence>
                        {hoveredTerm && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, x: "-50%" }}
                            animate={{ opacity: 1, y: 0, x: "-50%" }}
                            exit={{ opacity: 0, y: 5, x: "-50%" }}
                            className="absolute top-full left-1/2 mt-6 px-6 py-3 bg-neutral-900/95 border border-hairline-strong rounded-xl shadow-2xl whitespace-nowrap z-20 backdrop-blur-xl"
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-bold text-ink tracking-wide uppercase">
                                {hoveredTerm === "U" && "Total Utility (Score)"}
                                {hoveredTerm === "mu" &&
                                  "Portfolio Return Proxy"}
                                {hoveredTerm === "lambda" &&
                                  "Risk Aversion Parameter"}
                                {hoveredTerm === "sigma" &&
                                  "Portfolio Variance (Risk)"}
                              </span>
                              <span className="text-xs text-neutral-400">
                                {hoveredTerm === "U" &&
                                  "Estimated return minus a variance penalty."}
                                {hoveredTerm === "mu" &&
                                  "Weighted sum of yield-and-beta proxies."}
                                {hoveredTerm === "lambda" &&
                                  "Penalty multiplier for volatility."}
                                {hoveredTerm === "sigma" &&
                                  "A beta-based estimate fills gaps in the historical data."}
                              </span>
                            </div>
                            {/* Triangle arrow */}
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-neutral-900/95 border-t border-l border-hairline-strong rotate-45" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Interactive Slider Demo */}
                    <div className="w-full max-w-sm bg-surface-card border border-hairline rounded-xl p-6 flex flex-col gap-6 backdrop-blur-sm">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-300 font-medium">
                          Risk Aversion (λ)
                        </span>
                        <span className="font-mono text-ink bg-surface-soft px-2 py-1 rounded">
                          {lambda.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="10"
                        step="0.5"
                        value={lambda}
                        onChange={(e) => setLambda(parseFloat(e.target.value))}
                        aria-label="Risk aversion example"
                        className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                      />

                      {/* Mini Graph Visual */}
                      <div className="flex gap-2 h-32 items-end pt-4 border-b border-hairline pb-0">
                        {/* Hypothetical Assets */}
                        {[
                          {
                            name: "High Growth",
                            base: 80,
                            risk: 5,
                            color: "bg-purple-500",
                          },
                          {
                            name: "Balanced",
                            base: 50,
                            risk: 0.5,
                            color: "bg-purple-500",
                          },
                          {
                            name: "Conservative",
                            base: 20,
                            risk: -4,
                            color: "bg-purple-500",
                          },
                        ].map((asset, i) => (
                          <div
                            key={i}
                            className="flex-1 flex flex-col justify-end h-full gap-2 group relative"
                          >
                            <motion.div
                              className={cn(
                                "w-full rounded-t-sm opacity-80 group-hover:opacity-100 transition-opacity relative",
                                asset.color,
                              )}
                              animate={{
                                height: `${Math.max(5, asset.base - lambda * (asset.risk + 5))}%`,
                              }}
                              transition={{ type: "spring", stiffness: 100 }}
                            >
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-dune/50 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-hairline z-10">
                                Score:{" "}
                                {Math.max(
                                  0,
                                  Math.round(
                                    asset.base - lambda * (asset.risk + 5),
                                  ),
                                )}
                              </div>
                            </motion.div>
                            <div className="text-[10px] text-neutral-500 text-center font-medium truncate w-full">
                              {asset.name}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-sm leading-5 text-center text-body">
                        Illustration only. Changing λ shows how a risk penalty
                        can affect sample scores; these are not fund forecasts.
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* === STEP 2: GREEDY LOOK-AHEAD === */}
                {activeStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full max-w-lg flex flex-col items-center gap-8"
                  >
                    <p className="text-sm leading-5 text-center text-body">
                      Example values only. These score changes are not based on
                      actual holdings or predictions.
                    </p>
                    <div className="flex items-center gap-3 rounded-card border border-hairline-strong bg-surface-card px-6 py-4 font-serif text-lg text-ink">
                      <span>Maximize</span>
                      <span className="text-ink font-bold">ΔU</span>
                      <span>=</span>
                      <span>
                        U(w + δ<sub className="text-xs">i</sub>)
                      </span>
                      <span>-</span>
                      <span>U(w)</span>
                    </div>

                    {/* Simulation Stage */}
                    <div className="w-full bg-surface-card rounded-card p-6 border border-hairline min-h-[280px] flex flex-col justify-between">
                      <div className="flex justify-between items-end gap-2 h-40 mb-6 relative">
                        {/* Baseline */}
                        <div className="absolute inset-x-0 bottom-[40%] border-t border-dashed border-hairline-strong flex items-end justify-end px-2">
                          <span className="text-xs text-neutral-500 mb-1">
                            Current U
                          </span>
                        </div>

                        {["A", "B", "C", "D", "E"].map((ticker, i) => {
                          const marginalGains = [15, 35, 5, 55, 20]; // D is winner
                          const gain = marginalGains[i];
                          const isWinner = i === 3;

                          return (
                            <div
                              key={ticker}
                              className="flex-1 flex flex-col items-center gap-2 relative group"
                            >
                              {/* Bar Container */}
                              <div className="w-full max-w-[40px] flex flex-col justify-end h-full relative">
                                {/* Base Utility (Existing) */}
                                <div className="w-full bg-surface-soft h-[40%] rounded-b-card border-t border-hairline" />

                                {/* Marginal Utility (The Gain) */}
                                <motion.div
                                  className={cn(
                                    "w-full rounded-t-card absolute bottom-[40%] border-b border-black/50 transition-colors duration-500",
                                    simulationState === "SELECTED" && isWinner
                                      ? "bg-accent"
                                      : simulationState === "SELECTED"
                                        ? "bg-surface-card opacity-20"
                                        : "bg-surface-soft",
                                  )}
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{
                                    height:
                                      simulationState !== "IDLE"
                                        ? `${gain}%`
                                        : 0,
                                    opacity: simulationState !== "IDLE" ? 1 : 0,
                                  }}
                                  transition={{
                                    delay:
                                      simulationState === "SIMULATING"
                                        ? i * 0.1
                                        : 0,
                                    duration: 0.4,
                                  }}
                                >
                                  {/* Value Label */}
                                  {(simulationState === "CALCULATING" ||
                                    simulationState === "SELECTED") && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className={cn(
                                        "absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono font-bold",
                                        isWinner &&
                                          simulationState === "SELECTED"
                                          ? "text-ink scale-125"
                                          : "text-neutral-400",
                                      )}
                                    >
                                      +{gain}
                                    </motion.div>
                                  )}
                                </motion.div>
                              </div>

                              {/* Ticker Label */}
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-500",
                                  simulationState === "SELECTED" && isWinner
                                    ? "bg-accent text-[var(--on-accent)] border-accent scale-110"
                                    : "bg-surface-card border-hairline text-neutral-500",
                                )}
                              >
                                {ticker}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Controls / Status */}
                      <div className="flex flex-col items-center gap-4">
                        <AnimatePresence mode="wait">
                          {simulationState === "IDLE" && (
                            <motion.button
                              type="button"
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              onClick={runSimulation}
                              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 flex items-center gap-2"
                            >
                              <Zap className="w-4 h-4" /> Run Example
                            </motion.button>
                          )}

                          {simulationState === "SIMULATING" && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-sm text-muted font-mono flex items-center gap-2"
                            >
                              <span className="w-2 h-2 bg-surface-soft rounded-full animate-pulse" />
                              Testing each candidate...
                            </motion.div>
                          )}

                          {simulationState === "CALCULATING" && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-sm text-neutral-400 font-mono flex items-center gap-2"
                            >
                              <Calculator className="w-4 h-4" />
                              Comparing score changes...
                            </motion.div>
                          )}

                          {simulationState === "SELECTED" && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-col items-center gap-3"
                            >
                              <div className="text-sm text-ink font-medium">
                                In this example, Asset D has the largest score increase (+55).
                              </div>
                              <button
                                type="button"
                                onClick={resetSimulation}
                                className="min-h-11 rounded px-3 text-sm text-muted underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                              >
                                Reset example
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* === STEP 3: CONSTRAINTS === */}
                {activeStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="relative w-full max-w-lg flex flex-col items-center gap-10"
                  >
                    {/* Constraints Formula Block */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      <div className="bg-surface-card border border-hairline p-4 rounded-card flex flex-col items-center justify-center gap-2">
                        <div className="text-sm font-medium text-body">
                          Integer Shares
                        </div>
                        <div className="font-serif text-xl text-ink">
                          n<sub className="text-sm">i</sub> ∈ ℤ
                          <sup className="text-sm">≥0</sup>
                        </div>
                        <div className="text-sm leading-5 text-center text-body">
                          Must be whole numbers {`{0, 1, 2...}`}
                        </div>
                      </div>

                      <div className="bg-surface-card border border-hairline p-4 rounded-card flex flex-col items-center justify-center gap-2">
                        <div className="text-sm font-medium text-body">
                          Budget Constraint
                        </div>
                        <div className="font-serif text-xl text-ink flex items-center gap-2">
                          <span>Σ</span>
                          <span className="text-base">
                            (n<sub className="text-xs">i</sub> × p
                            <sub className="text-xs">i</sub>)
                          </span>
                          <span>≤</span>
                          <span className="text-ink">B</span>
                        </div>
                        <div className="text-sm leading-5 text-center text-body">
                          Total cost cannot exceed cash
                        </div>
                      </div>
                    </div>

                    {/* Visual Metaphor */}
                    <div className="relative flex aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-card border border-hairline bg-surface-card p-6">

                      <div className="flex items-end gap-1 h-32 w-full justify-center">
                        {/* Correct Stack */}
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex flex-col-reverse gap-1">
                            {[1, 2, 3].map((i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.2 }}
                                className="w-12 h-8 bg-surface-soft border border-hairline rounded flex items-center justify-center"
                              >
                                <span className="text-xs text-ink">
                                  1.0
                                </span>
                              </motion.div>
                            ))}
                          </div>
                          <div className="flex items-center gap-1 text-sm font-medium text-body">
                            <Target className="w-3 h-3" /> Valid
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-24 bg-surface-soft mx-4" />

                        {/* Incorrect Stack */}
                        <div className="flex flex-col items-center gap-2 opacity-50 grayscale">
                          <div className="flex flex-col-reverse gap-1 relative">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="w-12 h-8 bg-surface-soft border border-hairline-strong rounded flex items-center justify-center"
                              />
                            ))}
                            {/* Fractional Part */}
                            <div className="absolute -top-5 w-12 h-4 bg-surface-soft border border-hairline rounded-t-card flex items-center justify-center">
                              <span className="text-xs text-ink">
                                0.42
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-medium text-muted">
                            <Lock className="w-3 h-3" /> Invalid
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Step Indicator dots for mobile */}
            <div className="flex lg:hidden justify-center gap-2 pb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i === activeStep ? "bg-emerald-500" : "bg-neutral-700",
                  )}
                />
              ))}
            </div>
          </div>

          {/* RIGHT: Navigation & Details (5 Columns) */}
          <div className="lg:col-span-5 bg-canvas border-l border-hairline flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="flex flex-col gap-0">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = activeStep === index;

                return (
                  <button
                    type="button"
                    key={step.id}
                    aria-pressed={isActive}
                    onClick={() => {
                      setActiveStep(index);
                      setSimulationState("IDLE"); // Reset simulation state
                    }}
                    className={cn(
                      "group text-left p-6 md:p-8 transition-all duration-300 border-b border-hairline relative",
                      isActive
                        ? "bg-surface-card"
                      : "text-muted hover:bg-surface-soft hover:text-ink",
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-indicator"
                        className="absolute left-0 top-0 bottom-0 w-1 bg-accent"
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30,
                        }}
                      />
                    )}

                    <div className="flex gap-4">
                      <div
                        className={cn(
                          "mt-1 p-2.5 rounded-card h-fit transition-colors border",
                          isActive
                            ? "bg-surface-soft text-ink border-hairline-strong"
                            : "bg-surface-card text-neutral-500 border-hairline group-hover:border-hairline-strong",
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h3
                            className={cn(
                              "font-semibold text-lg",
                              isActive ? "text-ink" : "text-neutral-300",
                            )}
                          >
                            {step.title}
                          </h3>
                          {isActive && (
                            <ChevronRight className="w-4 h-4 text-muted" />
                          )}
                        </div>
                        <p className="mb-2 text-sm text-muted">
                          {step.subtitle}
                        </p>
                        <p className="text-sm text-neutral-400 leading-relaxed mb-4">
                          {step.description}
                        </p>

                        <AnimatePresence>
                          {isActive && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="grid gap-3 pt-2">
                                {step.details.map((detail, i) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-3 rounded-card border border-hairline bg-surface-card p-3"
                                  >
                                    <detail.icon className="w-4 h-4 text-neutral-500 mt-0.5" />
                                    <div>
                                      <div className="text-xs text-neutral-200 font-medium mb-0.5">
                                        {detail.label}
                                      </div>
                                      <div className="text-xs text-neutral-500 leading-snug">
                                        {detail.text}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
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
    </div>
  );
}
