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
  Plus,
  Equal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: "objective",
    title: "Objective Function",
    subtitle: "Maximizing utility",
    icon: Target,
    color: "emerald",
    description:
      'We calculate a "Utility Score" (U) for every possible portfolio configuration. The goal is to maximize this score, which represents the optimal trade-off between expected profit and potential loss.',
    details: [
      {
        label: "Returns (μ)",
        text: "Historical mean returns projected forward",
        icon: TrendingUp,
      },
      {
        label: "Risk (Σ)",
        text: "Covariance matrix defining asset volatility",
        icon: ShieldCheck,
      },
      {
        label: "Aversion (λ)",
        text: "User-defined risk tolerance parameter",
        icon: Lock,
      },
    ],
  },
  {
    id: "process",
    title: "Iterative Selection",
    subtitle: "Greedy marginal decision making",
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
        text: "Calculate improvement in Portfolio U",
        icon: Scale,
      },
      {
        label: "Selection",
        text: "Commit capital to the winner",
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
      "Unlike pure Modern Portfolio Theory (MPT) which assumes fractional shares and infinite capital, our algorithm respects market realities.",
    details: [
      {
        label: "Integer Shares",
        text: "No fractional share assumptions",
        icon: Target,
      },
      {
        label: "Budget",
        text: "Strict adherence to available cash",
        icon: Scale,
      },
      {
        label: "Rebalancing",
        text: "Optimizes new cash + existing holdings",
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
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-blue-500/5 to-purple-500/5 blur-3xl rounded-full opacity-30 pointer-events-none" />

      <div className="relative glass-panel border border-white/10 bg-black/40 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <BrainCircuit className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Optimization Algorithm
              </h2>
            </div>
            <p className="text-neutral-400 max-w-2xl text-sm">
              Our Discrete Mean-Variance optimizer uses a greedy look-ahead
              strategy to build portfolios that mathematically maximize
              risk-adjusted returns.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            <Calculator className="w-3 h-3" />
            <span>v2.1.0</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-[600px]">
          {/* LEFT: Interactive Visualizer (7 Columns) */}
          <div className="lg:col-span-7 bg-black/20 relative overflow-hidden flex flex-col border-r border-white/10">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none" />

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
                    <div className="relative group">
                      <div className="absolute -inset-6 bg-emerald-500/10 blur-2xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                      <div className="relative bg-black/80 border border-white/10 px-10 py-8 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-4 text-3xl md:text-4xl font-serif text-white">
                        <span
                          className={cn(
                            "transition-colors cursor-help italic font-bold",
                            hoveredTerm === "U"
                              ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                              : "text-white",
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
                                ? "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]"
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
                                ? "text-rose-400 scale-110 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]"
                                : "text-rose-400",
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
                                ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
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
                            className="absolute top-full left-1/2 mt-6 px-6 py-3 bg-neutral-900/95 border border-white/20 rounded-xl shadow-2xl whitespace-nowrap z-20 backdrop-blur-xl"
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-bold text-white tracking-wide uppercase">
                                {hoveredTerm === "U" && "Total Utility (Score)"}
                                {hoveredTerm === "mu" &&
                                  "Expected Portfolio Return"}
                                {hoveredTerm === "lambda" &&
                                  "Risk Aversion Parameter"}
                                {hoveredTerm === "sigma" &&
                                  "Portfolio Variance (Risk)"}
                              </span>
                              <span className="text-xs text-neutral-400">
                                {hoveredTerm === "U" &&
                                  "Higher is better. Balancing greed vs. fear."}
                                {hoveredTerm === "mu" &&
                                  "Weighted sum of asset returns."}
                                {hoveredTerm === "lambda" &&
                                  "Penalty multiplier for volatility."}
                                {hoveredTerm === "sigma" &&
                                  "Statistical measure of portfolio fluctuation."}
                              </span>
                            </div>
                            {/* Triangle arrow */}
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-neutral-900/95 border-t border-l border-white/20 rotate-45" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Interactive Slider Demo */}
                    <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col gap-6 backdrop-blur-sm">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-300 font-medium">
                          Risk Aversion (λ)
                        </span>
                        <span className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
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
                        className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                      />

                      {/* Mini Graph Visual */}
                      <div className="flex gap-2 h-32 items-end pt-4 border-b border-white/10 pb-0">
                        {/* Hypothetical Assets */}
                        {[
                          {
                            name: "High Growth",
                            base: 80,
                            risk: 5,
                            color: "bg-blue-500",
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
                            color: "bg-emerald-500",
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
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10 z-10">
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
                      <div className="text-xs text-neutral-500 text-center italic">
                        As λ increases, risky assets lose utility score faster.
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
                    {/* The Formula */}
                    <div className="bg-black/60 border border-white/10 px-6 py-4 rounded-xl flex items-center gap-3 text-lg font-serif text-neutral-300">
                      <span>Maximize</span>
                      <span className="text-emerald-400 font-bold">ΔU</span>
                      <span>=</span>
                      <span>
                        U(w + δ<sub className="text-xs">i</sub>)
                      </span>
                      <span>-</span>
                      <span>U(w)</span>
                    </div>

                    {/* Simulation Stage */}
                    <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10 min-h-[280px] flex flex-col justify-between">
                      <div className="flex justify-between items-end gap-2 h-40 mb-6 relative">
                        {/* Baseline */}
                        <div className="absolute inset-x-0 bottom-[40%] border-t border-dashed border-white/20 flex items-end justify-end px-2">
                          <span className="text-[10px] text-neutral-500 mb-1">
                            Current U
                          </span>
                        </div>

                        {["A", "B", "C", "D", "E"].map((ticker, i) => {
                          const baseH = 40;
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
                                <div className="w-full bg-white/10 h-[40%] rounded-b-sm border-t border-white/5" />

                                {/* Marginal Utility (The Gain) */}
                                <motion.div
                                  className={cn(
                                    "w-full rounded-t-sm absolute bottom-[40%] border-b border-black/50 transition-colors duration-500",
                                    simulationState === "SELECTED" && isWinner
                                      ? "bg-emerald-500"
                                      : simulationState === "SELECTED"
                                        ? "bg-white/5 opacity-20"
                                        : "bg-blue-500",
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
                                          ? "text-emerald-400 scale-125"
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
                                    ? "bg-emerald-500 text-black border-emerald-400 scale-110 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                                    : "bg-white/5 border-white/10 text-neutral-500",
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
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              onClick={runSimulation}
                              className="flex items-center gap-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                            >
                              <Zap className="w-4 h-4" /> Start Simulation
                            </motion.button>
                          )}

                          {simulationState === "SIMULATING" && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-sm text-blue-400 font-mono flex items-center gap-2"
                            >
                              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                              Simulating buy orders...
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
                              Calculating Marginals...
                            </motion.div>
                          )}

                          {simulationState === "SELECTED" && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex flex-col items-center gap-3"
                            >
                              <div className="text-sm text-emerald-400 font-medium">
                                Asset D maximizes Utility (+55)
                              </div>
                              <button
                                onClick={resetSimulation}
                                className="text-xs text-neutral-500 hover:text-white underline underline-offset-4"
                              >
                                Reset Simulation
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
                      <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2">
                        <div className="text-xs text-neutral-400 uppercase tracking-widest font-bold">
                          Integer Shares
                        </div>
                        <div className="font-serif text-xl text-white">
                          n<sub className="text-sm">i</sub> ∈ ℤ
                          <sup className="text-sm">≥0</sup>
                        </div>
                        <div className="text-[10px] text-neutral-500 text-center">
                          Must be whole numbers {`{0, 1, 2...}`}
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2">
                        <div className="text-xs text-neutral-400 uppercase tracking-widest font-bold">
                          Budget Constraint
                        </div>
                        <div className="font-serif text-xl text-white flex items-center gap-2">
                          <span>Σ</span>
                          <span className="text-base">
                            (n<sub className="text-xs">i</sub> × p
                            <sub className="text-xs">i</sub>)
                          </span>
                          <span>≤</span>
                          <span className="text-emerald-400">B</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 text-center">
                          Total cost cannot exceed cash
                        </div>
                      </div>
                    </div>

                    {/* Visual Metaphor */}
                    <div className="relative w-full max-w-sm aspect-video bg-black/40 border border-white/10 rounded-xl overflow-hidden p-6 flex items-center justify-center">
                      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />

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
                                className="w-12 h-8 bg-emerald-500/20 border border-emerald-500/50 rounded flex items-center justify-center"
                              >
                                <span className="text-[10px] text-emerald-400">
                                  1.0
                                </span>
                              </motion.div>
                            ))}
                          </div>
                          <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            <Target className="w-3 h-3" /> Valid
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-24 bg-white/10 mx-4" />

                        {/* Incorrect Stack */}
                        <div className="flex flex-col items-center gap-2 opacity-50 grayscale">
                          <div className="flex flex-col-reverse gap-1 relative">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="w-12 h-8 bg-white/10 border border-white/20 rounded flex items-center justify-center"
                              />
                            ))}
                            {/* Fractional Part */}
                            <div className="absolute -top-5 w-12 h-4 bg-rose-500/20 border border-rose-500/50 rounded-t flex items-center justify-center">
                              <span className="text-[9px] text-rose-400">
                                0.42
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-neutral-500 font-medium flex items-center gap-1">
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
                    i === activeStep ? "bg-emerald-500" : "bg-white/20",
                  )}
                />
              ))}
            </div>
          </div>

          {/* RIGHT: Navigation & Details (5 Columns) */}
          <div className="lg:col-span-5 bg-white/[0.02] border-l border-white/10 flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="flex flex-col gap-0">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = activeStep === index;

                return (
                  <button
                    key={step.id}
                    onClick={() => {
                      setActiveStep(index);
                      setSimulationState("IDLE"); // Reset simulation state
                    }}
                    className={cn(
                      "group text-left p-6 md:p-8 transition-all duration-300 border-b border-white/5 relative",
                      isActive
                        ? "bg-white/5"
                        : "hover:bg-white/[0.02] opacity-60 hover:opacity-100",
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-indicator"
                        className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"
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
                          "mt-1 p-2.5 rounded-xl h-fit transition-colors border",
                          isActive
                            ? `bg-${step.color}-500/10 text-${step.color}-400 border-${step.color}-500/30`
                            : "bg-white/5 text-neutral-500 border-white/5 group-hover:border-white/10",
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h3
                            className={cn(
                              "font-semibold text-lg",
                              isActive ? "text-white" : "text-neutral-300",
                            )}
                          >
                            {step.title}
                          </h3>
                          {isActive && (
                            <ChevronRight className="w-4 h-4 text-emerald-500 animate-pulse" />
                          )}
                        </div>
                        <p className="text-xs font-mono text-emerald-500/70 mb-2 uppercase tracking-wide">
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
                                    className="flex items-start gap-3 p-3 rounded-lg bg-black/20 border border-white/5"
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
