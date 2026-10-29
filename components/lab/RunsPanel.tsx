"use client";

import { AlertTriangle } from "lucide-react";
import type { Metrics } from "@/lib/lab/engine/metrics";
import type { LabRun } from "./useLabEngine";
import { money, pct, ratio, signedPct } from "./format";
import { cn } from "@/lib/utils";

const ROWS: { label: string; title: string; get: (m: Metrics, ccy: string) => string }[] = [
  { label: "Total return", title: "Time-weighted, contributions excluded", get: (m) => signedPct(m.totalReturn) },
  { label: "CAGR", title: "Compound annual growth rate, time-weighted", get: (m) => signedPct(m.cagr) },
  { label: "Volatility", title: "Annualized standard deviation of daily returns", get: (m) => pct(m.volatility) },
  { label: "Sharpe", title: "Annualized, risk-free rate 0%", get: (m) => ratio(m.sharpe) },
  { label: "Sortino", title: "Annualized, downside deviation, risk-free rate 0%", get: (m) => ratio(m.sortino) },
  { label: "Max drawdown", title: "Deepest fall from a previous high", get: (m) => pct(m.maxDrawdown?.depth ?? 0) },
  { label: "Calmar", title: "CAGR divided by max drawdown", get: (m) => ratio(m.calmar) },
  { label: "Positive months", title: "Share of calendar months with a gain", get: (m) => pct(m.positiveMonths, 0) },
  { label: "Turnover", title: "Average one-way trading per year, as a share of the portfolio", get: (m) => pct(m.turnover, 0) },
  { label: "Costs paid", title: "Commission plus slippage", get: (m, c) => money(m.costsPaid, c) },
  { label: "Dividends", title: "Cash dividends received", get: (m, c) => money(m.dividendsReceived, c) },
];

interface RunsPanelProps {
  runs: LabRun[];
  selectedId: number | null;
  compareIds: number[];
  onSelect: (id: number) => void;
  onToggleCompare: (id: number) => void;
}

export default function RunsPanel({ runs, selectedId, compareIds, onSelect, onToggleCompare }: RunsPanelProps) {
  const run = runs.find((r) => r.id === selectedId) ?? null;
  const bench = run?.report.benchmark;

  return (
    <div className="space-y-5 p-4">
      {run && (
        <section aria-labelledby="lab-metrics">
          <h3 id="lab-metrics" className="mb-2 text-sm font-semibold text-ink">Metrics</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted">
                <th scope="col" className="sr-only">Measure</th>
                <th scope="col" className="py-1 text-right font-medium">Strategy</th>
                {bench && <th scope="col" className="py-1 text-right font-medium">{bench.ticker}</th>}
              </tr>
            </thead>
            <tbody className="font-mono">
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-hairline">
                  <th scope="row" className="py-1.5 text-left font-sans font-normal text-body" title={row.title}>{row.label}</th>
                  <td className="py-1.5 text-right text-ink">{row.get(run.report.metrics, run.report.currency)}</td>
                  {bench && <td className="py-1.5 text-right text-muted">{row.get(bench.metrics, run.report.currency)}</td>}
                </tr>
              ))}
              {bench && (
                <>
                  <tr className="border-t border-hairline">
                    <th scope="row" className="py-1.5 text-left font-sans font-normal text-body" title={`Daily return sensitivity to ${bench.ticker}`}>Beta</th>
                    <td className="py-1.5 text-right text-ink">{ratio(run.report.metrics.beta)}</td>
                    <td />
                  </tr>
                  <tr className="border-t border-hairline">
                    <th scope="row" className="py-1.5 text-left font-sans font-normal text-body" title="Annualized return not explained by beta">Alpha</th>
                    <td className="py-1.5 text-right text-ink">{signedPct(run.report.metrics.alpha)}</td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </section>
      )}

      {run && run.report.sim.warnings.length > 0 && (
        <section aria-labelledby="lab-warnings" className="rounded-lg p-3 ring-1 ring-hairline">
          <h3 id="lab-warnings" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <AlertTriangle className="h-4 w-4 text-muted" aria-hidden /> Warnings
          </h3>
          <ul className="space-y-1 text-xs text-body">
            {run.report.sim.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="lab-runs">
        <h3 id="lab-runs" className="mb-2 text-sm font-semibold text-ink">Runs this session</h3>
        {runs.length === 0 ? (
          <p className="text-xs text-muted">Runs appear here. Tick two or more to compare them.</p>
        ) : (
          <ul className="space-y-1">
            {[...runs].reverse().map((r) => (
              <li key={r.id} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5", r.id === selectedId && "bg-surface-soft")}>
                <input
                  type="checkbox"
                  aria-label={`Compare run ${r.id}`}
                  checked={compareIds.includes(r.id)}
                  onChange={() => onToggleCompare(r.id)}
                />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(r.id)} aria-current={r.id === selectedId}>
                  <span className="block truncate text-sm text-ink">{r.id}. {r.name}</span>
                  <span className="block font-mono text-xs text-muted">
                    CAGR {signedPct(r.report.metrics.cagr)} · DD {pct(r.report.metrics.maxDrawdown?.depth ?? 0)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {run && (
        <section aria-labelledby="lab-notes" className="space-y-1.5 text-xs text-muted">
          <h3 id="lab-notes" className="text-sm font-semibold text-ink">About this result</h3>
          <p>Hypothetical. Built from past prices, so it says nothing certain about the future. Not advice; the Lab never places trades.</p>
          <p>Data: Yahoo Finance daily bars, split-adjusted, dividends paid on the ex-date. Fetched {new Date(run.dataFetchedAt).toLocaleString()}.</p>
          <p>Tickers you chose today may include funds that survived while others closed, which flatters long backtests.</p>
          <p className="break-all font-mono">Run {run.report.hash.slice(0, 16)}</p>
        </section>
      )}
    </div>
  );
}
