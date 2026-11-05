"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PortfolioItem } from "@/types";
import {
  optimizePortfolioGreedy,
  GreedyOptimizationResult,
  getOptimizerBeta,
  getOptimizerReturnProxy,
  weightsFromShares,
} from "@/lib/optimizer";
import { cn, formatCurrency } from "@/lib/utils";
import { estimateAnnualCovariance } from "@/lib/math/covariance";

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

export default function OptimizationPanel({
  portfolio,
  onCalibrating,
  onApply,
}: OptimizationPanelProps) {
  const [amountText, setAmountText] = useState(String(DEFAULT_AMOUNT));
  const amount = Math.max(0, Number(amountText) || 0);
  const [strategyMode, setStrategyMode] = useState<StrategyMode>("Balanced");
  const [result, setResult] = useState<GreedyOptimizationResult | null>(null);
  const [appliedKey, setAppliedKey] = useState<string | null>(null);

  const riskProfile = STRATEGY_MODES.find((s) => s.mode === strategyMode)!.profile;
  const currency = portfolio[0]?.currency;

  // Risk and return use the same market exposure, so a fund the model prices
  // as 80% equity is also treated as having 80%-equity volatility.
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

  useEffect(() => {
    if (portfolio.length < 2) {
      const timer = setTimeout(() => {
        setResult(null);
        onCalibrating?.(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    onCalibrating?.(true);
    const timer = setTimeout(() => {
      setResult(optimizePortfolioGreedy({
        candidates,
        covarianceMatrix: covariance.matrix,
        riskProfile,
        budget: amount,
      }));
      onCalibrating?.(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [amount, portfolio.length, candidates, covariance, riskProfile, onCalibrating]);

  useEffect(() => () => onCalibrating?.(false), [onCalibrating]);

  const plan = useMemo(() => {
    if (!result) return null;
    const weights = weightsFromShares(portfolio, result.shares);
    const items: AllocationPlanItem[] = portfolio.map((p) => ({
      ticker: p.ticker,
      shares: result.shares[p.ticker] || 0,
      weight: weights[p.ticker] || 0,
    }));
    const invested = portfolio.reduce((sum, p) => sum + (result.shares[p.ticker] || 0) * (p.price || 0), 0);

    // Equity share, only when every holding reports a mix; a missing mix
    // would otherwise read as 0% equity.
    const hasMix = (p: PortfolioItem) => {
      const a = p.allocation;
      return !!a && a.equities + a.bonds + a.cash > 0;
    };
    const equityShare = invested > 0 && portfolio.every(hasMix)
      ? portfolio.reduce((sum, p) => {
          const a = p.allocation;
          return sum + (result.shares[p.ticker] || 0) * (p.price || 0) * (a.equities / (a.equities + a.bonds + a.cash));
        }, 0) / invested
      : null;
    return { items, invested, leftover: result.remainingBudget, equityShare };
  }, [portfolio, result]);

  const planKey = plan ? plan.items.map((i) => `${i.ticker}:${i.shares}`).join("|") : "";
  const applied = appliedKey !== null && appliedKey === planKey;

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
  const alreadyHeld = portfolio.filter((p) => p.shares > 0).map((p) => p.ticker);

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
                className="block w-full pl-4 pr-14 py-3 bg-surface-soft rounded-xl text-xl font-bold text-ink tabular-nums placeholder:text-muted-soft focus-visible:ring-2 focus-visible:ring-compass outline-none"
                placeholder="0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">
                {currency}
              </span>
            </div>
          </div>

          <div>
            <span id="optimizer-risk-label" className="block text-xs text-muted mb-1">Risk level</span>
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
      </div>

      {noPrices ? (
        <p className="border-t border-hairline p-4 text-sm text-muted">Waiting for prices before the plan can be built.</p>
      ) : !plan ? (
        <p className="border-t border-hairline p-4 text-sm text-muted">Calculating…</p>
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
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
            <dt className="text-muted">Invested</dt>
            <dd className="text-right font-bold tabular-nums text-ink">{formatCurrency(plan.invested, currency)}</dd>
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
                disabled={plan.invested <= 0 || applied}
                onClick={() => {
                  onApply(plan.items);
                  setAppliedKey(planKey);
                }}
              >
                {applied ? <><Check className="w-4 h-4" aria-hidden="true" /> Applied</> : "Use this allocation"}
              </button>
              <p className="min-w-0 flex-1 text-xs text-muted">
                {alreadyHeld.length > 0
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
            Each fund gets an expected return of its yield plus 6% per unit of stock exposure. Stock exposure comes from the fund&apos;s reported stock/bond mix, or its beta when no mix is reported.
          </p>
          <p>
            {covariance.source === "history"
              ? `Risk comes from ${covariance.samples} overlapping daily returns, so funds that move together are not treated as diversification.`
              : "Risk comes from each fund's stock exposure, because the holdings lack enough shared price history."}{" "}
            The risk level sets how much extra return the model needs before it accepts more volatility.
          </p>
          <p>
            It buys whole shares one lot at a time until less than one share&apos;s worth of cash is left. These are model estimates, not advice, and they do not predict future returns.
          </p>
        </div>
      </details>
    </div>
  );
}
