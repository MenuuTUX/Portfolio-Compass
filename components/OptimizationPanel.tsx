"use client";

import { useState, useMemo, useEffect } from "react";
import { m as motion } from "framer-motion";
import { EASE } from "./motion/Reveal";
import { Check } from "lucide-react";
import { PortfolioItem } from "@/types";
import {
  optimizePortfolioGreedy,
  GreedyOptimizationResult,
  getOptimizerBeta,
  getOptimizerReturnProxy,
  weightsFromShares,
  RISK_FREE,
  EQUITY_PREMIUM,
} from "@/lib/optimizer";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/utils";
import { HelpLabel, HelpTip } from "@/components/ui/HelpTip";
import { estimateAnnualCovariance } from "@/lib/math/covariance";
import { loadRiskProfile } from "@/lib/risk-profile";

export interface AllocationPlanItem {
  ticker: string;
  shares: number;
  /** Target weight in percent; the plan sums to 100. */
  weight: number;
}

interface OptimizationPanelProps {
  portfolio: PortfolioItem[];
  onCalibrating?: (isCalibrating: boolean) => void;
  /** Replaces every holding's shares and target weight with the plan. */
  onApply?: (plan: AllocationPlanItem[]) => void;
}

const STRATEGY_MODES = [
  { mode: "Conservative", profile: "conservative", hint: "Lower swings, lower expected growth" },
  { mode: "Balanced", profile: "balanced", hint: "Middle ground" },
  { mode: "Growth", profile: "growth", hint: "Higher expected growth, bigger swings" },
] as const;
type StrategyMode = (typeof STRATEGY_MODES)[number]["mode"];

const DEFAULT_AMOUNT = 10000;
/** Larger amounts are rejected: the model is for household portfolios, and huge budgets only slow the loop. */
const MAX_AMOUNT = 1e12;

export default function OptimizationPanel({
  portfolio,
  onCalibrating,
  onApply,
}: OptimizationPanelProps) {
  const [amountText, setAmountText] = useState(String(DEFAULT_AMOUNT));
  const parsedAmount = amountText.trim() === "" ? 0 : Number(amountText);
  const amountError = !Number.isFinite(parsedAmount)
    ? "Enter a number, for example 10000."
    : parsedAmount < 0
      ? "Enter an amount of zero or more."
      : parsedAmount > MAX_AMOUNT
        ? "Enter an amount of 1 trillion or less."
        : null;
  const amount = amountError ? 0 : parsedAmount;
  // Start at the level the quiz produced; the user can still change it.
  const [strategyMode, setStrategyMode] = useState<StrategyMode>(() => loadRiskProfile()?.profile ?? "Balanced");
  // null means the default: add to holdings when any shares are already held.
  const [holdingMode, setHoldingMode] = useState<"add" | "replace" | null>(null);
  const [result, setResult] = useState<GreedyOptimizationResult | null>(null);
  const [appliedKey, setAppliedKey] = useState<string | null>(null);

  const riskProfile = STRATEGY_MODES.find((s) => s.mode === strategyMode)!.profile;
  const currency = portfolio[0]?.currency;
  const alreadyHeld = portfolio.filter((p) => p.shares > 0).map((p) => p.ticker);
  const addToHoldings = (holdingMode ?? (alreadyHeld.length > 0 ? "add" : "replace")) === "add";

  // Risk and return both come from the same market exposure. Return always
  // uses it; risk uses it only for the single-index fallback, and switches to
  // the sample covariance when every holding has enough shared price history.
  const covariance = useMemo(
    () => estimateAnnualCovariance(portfolio.map((p) => ({ ...p, beta: getOptimizerBeta(p) }))),
    [portfolio],
  );
  const candidates = useMemo(
    () => portfolio.map((p) => ({
      ticker: p.ticker,
      price: p.price,
      expectedReturn: getOptimizerReturnProxy(p),
    })),
    [portfolio],
  );
  // Adding new money starts from the current shares, so the plan is the extra
  // shares to buy. Replacing starts from nothing.
  const startingShares = useMemo(
    () => Object.fromEntries(portfolio.map((p) => [p.ticker, addToHoldings ? p.shares || 0 : 0])),
    [portfolio, addToHoldings],
  );

  useEffect(() => {
    if (portfolio.length < 2) {
      const timer = setTimeout(() => {
        setResult(null);
        onCalibrating?.(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    if (amountError) {
      onCalibrating?.(false);
      return;
    }
    onCalibrating?.(true);
    const timer = setTimeout(() => {
      try {
        setResult(optimizePortfolioGreedy({
          candidates,
          covarianceMatrix: covariance.matrix,
          riskProfile,
          budget: amount,
          initialShares: startingShares,
        }));
      } finally {
        onCalibrating?.(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [amount, amountError, portfolio.length, candidates, covariance, riskProfile, startingShares, onCalibrating]);

  useEffect(() => () => onCalibrating?.(false), [onCalibrating]);

  const plan = useMemo(() => {
    if (!result) return null;
    const weights = weightsFromShares(portfolio, result.shares);
    const items: AllocationPlanItem[] = portfolio.map((p) => ({
      ticker: p.ticker,
      shares: result.shares[p.ticker] || 0,
      weight: weights[p.ticker] || 0,
    }));
    const currentValue = portfolio.reduce((sum, p) => sum + (p.shares || 0) * (p.price || 0), 0);
    const totalValue = portfolio.reduce((sum, p) => sum + (result.shares[p.ticker] || 0) * (p.price || 0), 0);
    // New money in add mode; the whole plan in replace mode.
    const invested = addToHoldings ? totalValue - currentValue : totalValue;

    // Equity share, only when every holding reports a mix; a missing mix (null) would otherwise read as 0% equity.
    // `other` counts toward a known mix, so a gold fund (other: 100) reads as a known 0% equity holding.
    const equityFraction = (p: PortfolioItem): number | null => {
      const a = p.allocation;
      if (!a) return null;
      const total = a.equities + a.bonds + a.cash + (a.other ?? 0);
      return Number.isFinite(total) && total > 0 ? a.equities / total : null;
    };
    const equityShare = totalValue > 0 && portfolio.every((p) => equityFraction(p) !== null)
      ? portfolio.reduce((sum, p) => sum + (result.shares[p.ticker] || 0) * (p.price || 0) * equityFraction(p)!, 0) / totalValue
      : null;
    return { items, currentValue, totalValue, invested, leftover: result.remainingBudget, equityShare };
  }, [portfolio, result, addToHoldings]);

  const planKey = plan ? `${addToHoldings ? "add" : "replace"}|${plan.items.map((i) => `${i.ticker}:${i.shares}`).join("|")}` : "";
  const applied = appliedKey !== null && appliedKey === planKey;

  // Why the plan buys nothing, in plain words. Null when it buys something.
  const emptyPlanReason = (() => {
    if (!plan || plan.invested > 0) return null;
    if (!(amount > 0)) return "Enter an amount above zero to see a plan.";
    const buyable = candidates.filter((c) => c.expectedReturn > 0 && c.price > 0);
    if (buyable.length === 0) {
      return "None of your funds has an expected return above zero, so the model buys none of them. Keep the money in cash, or add funds with a positive expected return.";
    }
    const cheapest = Math.min(...buyable.map((c) => c.price));
    if (amount < cheapest) {
      return `The amount is too small to buy one whole share of any fund you hold. The cheapest share costs ${formatCurrency(cheapest, currency)}.`;
    }
    return "The model could not find a whole-share plan for this amount. Try a larger amount.";
  })();

  if (portfolio.length < 2) {
    return (
      <div className="rounded-lg ring-1 ring-hairline bg-surface-card p-4 text-sm text-body">
        <p className="font-bold text-ink">Add at least two holdings</p>
        <p className="mt-1 text-muted">
          The optimizer splits your money across the funds in your portfolio, so it needs at least two to choose between.
        </p>
      </div>
    );
  }

  const noPrices = portfolio.every((p) => !(p.price > 0));

  return (
    <div className="@container flex flex-col bg-surface-card ring-1 ring-hairline rounded-lg">
      <div className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-base font-bold text-ink">Optimize allocation</h2>
          <p className="mt-1 text-sm leading-5 text-muted">
            Enter how much you want to invest and pick a risk level. The model splits it across your holdings in whole shares.
          </p>
        </div>

        <div className="grid gap-4 @lg:grid-cols-2">
          <div>
            <label htmlFor="optimizer-amount" className="block text-xs text-muted mb-1">
              Amount to invest
            </label>
            <div className="relative">
              <input
                id="optimizer-amount"
                type="number"
                inputMode="decimal"
                min={0}
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                aria-invalid={amountError ? true : undefined}
                aria-describedby={amountError ? "optimizer-amount-error" : undefined}
                className="block w-full pl-4 pr-14 py-3 bg-surface-soft rounded-xl text-xl font-bold text-ink tabular-nums placeholder:text-muted-soft focus-visible:ring-2 focus-visible:ring-compass outline-none"
                placeholder="0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
                {currency}
              </span>
            </div>
            {amountError && (
              <p id="optimizer-amount-error" role="alert" className="mt-1 text-xs text-rose-400">
                {amountError}
              </p>
            )}
          </div>

          <div>
            <span id="optimizer-risk-label" className="block text-xs text-muted mb-1"><HelpLabel term="Risk level" /></span>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-soft p-1" role="radiogroup" aria-labelledby="optimizer-risk-label">
              {STRATEGY_MODES.map(({ mode, hint }) => (
                <button
                  type="button"
                  key={mode}
                  role="radio"
                  aria-checked={strategyMode === mode}
                  title={hint}
                  onClick={() => setStrategyMode(mode)}
                  className={cn(
                    "min-h-11 rounded-lg px-2 text-xs font-medium transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass",
                    strategyMode === mode
                      ? "bg-surface-card text-ink ring-1 ring-hairline"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              {STRATEGY_MODES.find((s) => s.mode === strategyMode)!.hint}
            </p>
          </div>
        </div>

        <div>
          <span id="optimizer-holdings-label" className="block text-xs text-muted mb-1"><HelpTip term="new money">How the amount is used</HelpTip></span>
          <div className="grid gap-1 rounded-xl bg-surface-soft p-1 @lg:grid-cols-2" role="radiogroup" aria-labelledby="optimizer-holdings-label">
            {([
              { mode: "add", label: "New money added to my current holdings" },
              { mode: "replace", label: "Replace my current shares" },
            ] as const).map(({ mode, label }) => (
              <button
                type="button"
                key={mode}
                role="radio"
                aria-checked={(mode === "add") === addToHoldings}
                onClick={() => setHoldingMode(mode)}
                className={cn(
                  "min-h-11 rounded-lg px-3 text-xs font-medium transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass",
                  (mode === "add") === addToHoldings
                    ? "bg-surface-card text-ink ring-1 ring-hairline"
                    : "text-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            {addToHoldings
              ? "The plan is the extra shares to buy. Your current shares stay."
              : "The plan replaces every current share with the new allocation."}
          </p>
        </div>
      </div>

      {noPrices ? (
        <p className="border-t border-hairline p-4 text-sm text-muted">Waiting for prices before the plan can be built.</p>
      ) : amountError ? null : !plan ? (
        <p className="border-t border-hairline p-4 text-sm text-muted">Calculating…</p>
      ) : emptyPlanReason ? (
        <p className="border-t border-hairline p-4 text-sm leading-5 text-body" role="status">{emptyPlanReason}</p>
      ) : (
        <>
          <ul className="divide-y divide-hairline border-t border-hairline" aria-label="Suggested allocation">
            {portfolio.map((item, rowIndex) => {
              const row = plan.items[rowIndex];
              return (
                <li key={item.ticker} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-bold text-ink">{item.ticker}</p>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-ink">{row.weight.toFixed(1)}%</p>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full bg-surface-soft rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-compass"
                        initial={false}
                        animate={{ width: `${Math.min(100, Math.max(0, row.weight))}%` }}
                        transition={{ duration: 0.4, ease: EASE }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted tabular-nums">
                      {row.shares > 0
                        ? `${row.shares} ${row.shares === 1 ? "share" : "shares"} · ${formatCurrency(row.shares * (item.price || 0), currency)}`
                        : "Not bought"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <dl className="grid grid-cols-[1fr_auto] gap-y-2 border-t border-hairline px-4 py-3 text-sm">
            <dt className="text-muted">Current value</dt>
            <dd className="text-right tabular-nums text-ink">{formatCurrency(plan.currentValue, currency)}</dd>
            <dt className="text-muted">{addToHoldings ? "New money invested" : "Invested"}</dt>
            <dd className="text-right font-bold tabular-nums text-ink">{formatCurrency(plan.invested, currency)}</dd>
            <dt className="text-muted">New total</dt>
            <dd className="text-right tabular-nums text-ink">{formatCurrency(plan.totalValue, currency)}</dd>
            <dt className="text-muted">Cash left over</dt>
            <dd className="text-right tabular-nums text-ink">{formatCurrency(plan.leftover, currency)}</dd>
            {plan.equityShare !== null && (
              <>
                <dt className="text-muted">Stocks vs bonds</dt>
                <dd className="text-right tabular-nums text-ink">
                  {Math.round(plan.equityShare * 100)}% / {100 - Math.round(plan.equityShare * 100)}%
                </dd>
              </>
            )}
          </dl>

          {plan.equityShare !== null && plan.equityShare > 0.75 && strategyMode === "Conservative" && (
            <p className="mx-4 mb-3 rounded-lg bg-surface-soft p-3 text-xs leading-5 text-muted">
              Your holdings are mostly stock funds, so even Conservative stays mostly stocks. Add a bond fund to lower the risk further.
            </p>
          )}

          {onApply && (
            <div className="flex flex-wrap items-center gap-3 border-t border-hairline p-4">
              <button
                type="button"
                className="ws-pill"
                disabled={applied}
                onClick={() => {
                  onApply(plan.items);
                  setAppliedKey(planKey);
                }}
              >
                {applied ? <><Check className="w-4 h-4" aria-hidden="true" /> Applied</> : "Use this allocation"}
              </button>
              <p className="min-w-0 flex-1 text-xs text-muted">
                {addToHoldings
                  ? `Adds the new shares to your current ones, then sets target weights from the new totals.`
                  : alreadyHeld.length > 0
                    ? `Replaces your current shares (${alreadyHeld.join(", ")}) and target weights with this plan.`
                    : `Sets the shares and target weights for all ${portfolio.length} holdings.`}
              </p>
            </div>
          )}
        </>
      )}

      <details className="group border-t border-hairline">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-compass">
          How it works
          <span className="text-muted transition-transform duration-75 group-open:rotate-180" aria-hidden="true">
            &#9662;
          </span>
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4 text-xs leading-5 text-muted">
          <p>
            Each fund gets an <HelpTip term="expected return" showIcon={false}>expected return</HelpTip> of {(RISK_FREE * 100).toFixed(0)}% (<HelpTip term="risk-free rate" showIcon={false}>the risk-free rate</HelpTip>) plus {(EQUITY_PREMIUM * 100).toFixed(0)}% per unit of stock exposure. Stock exposure comes from the fund&apos;s reported stock/bond mix, or its beta when no mix is reported. Yield is part of that return, not added on top.
          </p>
          <p>
            {covariance.source === "history"
              ? <>Risk comes from {covariance.samples} overlapping daily returns, so funds that move together are not treated as <HelpTip term="diversification" showIcon={false}>diversification</HelpTip>.</>
              : "Risk comes from each fund's stock exposure, because the holdings lack enough shared price history."}{" "}
            The risk level sets how much extra return the model needs before it accepts more <HelpTip term="volatility" showIcon={false}>volatility</HelpTip>.
          </p>
          <p>
            It buys whole shares in lots, then one share at a time, until less than one share&apos;s worth of cash is left. These are model estimates, not advice, and they do not predict future returns.
          </p>
        </div>
      </details>
    </div>
  );
}
