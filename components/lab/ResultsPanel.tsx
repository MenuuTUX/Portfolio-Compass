"use client";

import { useMemo, useState } from "react";
import { Download, LineChart } from "lucide-react";
import { motion } from "framer-motion";
import type { LabRun } from "./useLabEngine";
import LabChart, { type ChartSeries } from "./LabChart";
import { compactMoney, money, pct, signedPct } from "./format";
import { cn } from "@/lib/utils";

const TABS = ["Overview", "Drawdown", "Monthly", "Holdings", "Trades", "Compare"] as const;
type Tab = (typeof TABS)[number];
const DASHES = [undefined, "6 4", "2 3", "10 3 2 3", "1 4"];

/** Growth of 1 on a time-weighted basis, so runs with cash flows compare fairly. */
function growthOf(equity: ArrayLike<number>, flows?: ArrayLike<number>): Float64Array {
  const out = new Float64Array(equity.length);
  out[0] = 1;
  for (let t = 1; t < equity.length; t++) {
    const base = equity[t - 1] + (flows?.[t] ?? 0);
    out[t] = out[t - 1] * (base > 0 ? equity[t] / base : 1);
  }
  return out;
}

const growth = (run: LabRun) => growthOf(run.report.sim.equity, run.report.sim.flows);

function underwater(index: ArrayLike<number>): Float64Array {
  const out = new Float64Array(index.length);
  let peak = -Infinity;
  for (let t = 0; t < index.length; t++) {
    peak = Math.max(peak, index[t]);
    out[t] = index[t] / peak - 1;
  }
  return out;
}

function tradesCsv(run: LabRun): string {
  const rows = run.report.sim.trades.map((t) =>
    [t.date, t.ticker, t.shares > 0 ? "BUY" : "SELL", Math.abs(t.shares), t.price, t.commission].join(","),
  );
  return ["date,ticker,side,shares,price,commission", ...rows].join("\n");
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthlyTable({ run }: { run: LabRun }) {
  const byYear = new Map<string, (number | null)[]>();
  for (const m of run.report.metrics.monthlyReturns) {
    const [y, mo] = m.month.split("-");
    if (!byYear.has(y)) byYear.set(y, Array(12).fill(null));
    byYear.get(y)![Number(mo) - 1] = m.return;
  }
  const years = [...byYear.keys()].sort().reverse();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <caption className="sr-only">Monthly time-weighted returns by year</caption>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="py-1.5 pr-2 text-left font-medium">Year</th>
            {MONTHS.map((m) => <th key={m} scope="col" className="px-1 py-1.5 text-right font-medium">{m}</th>)}
            <th scope="col" className="pl-2 py-1.5 text-right font-medium">Year</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => {
            const months = byYear.get(y)!;
            const year = months.reduce<number>((acc, r) => (r == null ? acc : (1 + acc) * (1 + r) - 1), 0);
            return (
              <tr key={y} className="border-t border-hairline">
                <th scope="row" className="py-1.5 pr-2 text-left font-medium text-body">{y}</th>
                {months.map((r, i) => (
                  <td
                    key={i}
                    className={cn("px-1 py-1.5 text-right", r == null ? "text-muted-soft" : r >= 0 ? "text-emerald-400" : "text-rose-400")}
                    style={r == null ? undefined : { backgroundColor: `color-mix(in srgb, ${r >= 0 ? "var(--compass)" : "var(--loss)"} ${Math.min(30, Math.abs(r) * 300)}%, transparent)` }}
                  >
                    {r == null ? "" : signedPct(r)}
                  </td>
                ))}
                <td className={cn("pl-2 py-1.5 text-right font-semibold", year >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {signedPct(year)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HoldingsTable({ run }: { run: LabRun }) {
  const { tickers, close, sim, currency } = run.report;
  const N = tickers.length;
  const T = run.report.dates.length;
  const last = new Float64Array(N).fill(NaN);
  for (let t = 0; t < T; t++) {
    for (let j = 0; j < N; j++) if (!Number.isNaN(close[t * N + j])) last[j] = close[t * N + j];
  }
  const equity = sim.equity[T - 1];
  const rows = tickers
    .map((ticker, j) => {
      const shares = sim.holdings[(T - 1) * N + j];
      const value = shares * (last[j] || 0);
      return { ticker, shares, value, weight: equity > 0 ? value / equity : NaN };
    })
    .filter((r) => r.shares > 0);
  const cash = sim.cash[T - 1];
  return (
    <table className="w-full text-sm">
      <caption className="mb-2 text-left text-xs text-muted">Holdings at the close of {run.report.dates[T - 1]}</caption>
      <thead>
        <tr className="text-xs text-muted">
          <th scope="col" className="py-1.5 text-left font-medium">Ticker</th>
          <th scope="col" className="py-1.5 text-right font-medium">Shares</th>
          <th scope="col" className="py-1.5 text-right font-medium">Value</th>
          <th scope="col" className="py-1.5 text-right font-medium">Weight</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {rows.map((r) => (
          <tr key={r.ticker} className="border-t border-hairline">
            <th scope="row" className="py-1.5 text-left font-semibold text-ink">{r.ticker}</th>
            <td className="py-1.5 text-right text-body">{r.shares.toFixed(r.shares % 1 ? 4 : 0)}</td>
            <td className="py-1.5 text-right text-body">{money(r.value, currency)}</td>
            <td className="py-1.5 text-right text-body">{pct(r.weight)}</td>
          </tr>
        ))}
        <tr className="border-t border-hairline">
          <th scope="row" className="py-1.5 text-left font-semibold text-ink">Cash</th>
          <td />
          <td className="py-1.5 text-right text-body">{money(cash, currency)}</td>
          <td className="py-1.5 text-right text-body">{pct(equity > 0 ? cash / equity : NaN)}</td>
        </tr>
      </tbody>
    </table>
  );
}

const TRADE_LIMIT = 500;

function TradesTable({ run }: { run: LabRun }) {
  const trades = run.report.sim.trades;
  const shown = trades.slice(-TRADE_LIMIT).reverse();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-muted">
          {trades.length} trades{trades.length > TRADE_LIMIT ? `, newest ${TRADE_LIMIT} shown` : ""}. Prices include slippage.
        </p>
        <button type="button" className="ws-pill" onClick={() => download(`${run.name.replace(/\W+/g, "-")}-trades.csv`, tradesCsv(run))}>
          <Download className="h-3.5 w-3.5" aria-hidden /> CSV
        </button>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted">
            <th scope="col" className="py-1.5 text-left font-medium">Date</th>
            <th scope="col" className="py-1.5 text-left font-medium">Ticker</th>
            <th scope="col" className="py-1.5 text-left font-medium">Side</th>
            <th scope="col" className="py-1.5 text-right font-medium">Shares</th>
            <th scope="col" className="py-1.5 text-right font-medium">Price</th>
            <th scope="col" className="py-1.5 text-right font-medium">Fee</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {shown.map((t, i) => (
            <tr key={i} className="border-t border-hairline">
              <td className="py-1 text-body">{t.date}</td>
              <td className="py-1 font-semibold text-ink">{t.ticker}</td>
              <td className="py-1 text-body">{t.shares > 0 ? "Buy" : "Sell"}</td>
              <td className="py-1 text-right text-body">{Math.abs(t.shares).toFixed(Math.abs(t.shares) % 1 ? 4 : 0)}</td>
              <td className="py-1 text-right text-body">{t.price.toFixed(2)}</td>
              <td className="py-1 text-right text-body">{t.commission.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ResultsPanelProps {
  run: LabRun | null;
  compare: LabRun[];
}

export default function ResultsPanel({ run, compare }: ResultsPanelProps) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [log, setLog] = useState(true);

  // Both lines show what the starting amount grew to, time-weighted, so a
  // strategy with contributions still lines up against its benchmark.
  const series = useMemo(() => {
    if (!run) return null;
    const { sim, benchmark } = run.report;
    const start = sim.equity[0];
    const scale = (g: Float64Array) => g.map((v) => v * start);
    const out: ChartSeries[] = [{ label: run.name, values: scale(growth(run)) }];
    if (benchmark) {
      out.push({ label: `${benchmark.ticker} buy and hold`, values: scale(growthOf(benchmark.equity)), dash: "6 4", tone: "muted" });
    }
    return { lines: out, benchGrowth: benchmark ? growthOf(benchmark.equity) : null, final: out[0].values[out[0].values.length - 1] };
  }, [run]);

  if (!run || !series) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <LineChart className="h-6 w-6 text-muted-soft" aria-hidden />
        <p className="text-sm text-muted">Pick a template or enter tickers, then run a backtest.</p>
      </div>
    );
  }

  const { report } = run;
  const m = report.metrics;
  const own = growth(run);
  const benchGrowth = series.benchGrowth;
  const hasFlows = report.sim.flows.some((f) => f !== 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Results" className="flex shrink-0 gap-1 overflow-x-auto border-b border-hairline px-3 pt-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "relative h-9 shrink-0 px-3 text-sm font-medium transition-colors duration-75",
              tab === t ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {t}
            {t === "Compare" && compare.length > 0 && <span className="ml-1 font-mono text-xs text-muted">{compare.length}</span>}
            {tab === t && <motion.span layoutId="lab-tab" className="absolute inset-x-2 -bottom-px h-0.5 bg-ink" />}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar" role="tabpanel" aria-label={tab}>
        {tab === "Overview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-ink">{run.name}</h2>
                <p className="text-xs text-muted">
                  {m.startDate} to {m.endDate}, {report.currency}. Hypothetical, from past prices.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                <button type="button" role="switch" aria-checked={log} className="ws-switch" onClick={() => setLog(!log)}>
                  <span />
                </button>
                Log scale
              </label>
            </div>
            <LabChart
              dates={report.dates}
              series={series.lines}
              log={log}
              format={(v) => compactMoney(v, report.currency)}
              summary={`Growth of ${money(report.sim.equity[0], report.currency)} from ${m.startDate} to ${m.endDate}: ${money(series.final, report.currency)}${report.benchmark ? `, against ${money(series.lines[1].values[series.lines[1].values.length - 1], report.currency)} for ${report.benchmark.ticker}` : ""}.`}
            />
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-hairline sm:grid-cols-4">
              {[
                ["Final value", money(m.finalEquity, report.currency)],
                ["Contributed", money(m.netContributions, report.currency)],
                ["CAGR", signedPct(m.cagr)],
                ["Max drawdown", pct(m.maxDrawdown?.depth ?? 0)],
              ].map(([k, v]) => (
                <div key={k} className="bg-[var(--panel)] p-3">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5 font-mono text-base font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {run.lookahead?.leaks && (
              <p role="alert" className="rounded-lg p-3 text-sm text-rose-400 ring-1 ring-hairline">
                Lookahead check failed: weights from {run.lookahead.firstDate} changed when later prices were removed, so the strategy reads future prices or is not deterministic. Treat these results as invalid until that is fixed.
              </p>
            )}
            {hasFlows && (
              <p className="text-xs text-muted">
                The chart shows growth of the starting amount, time-weighted, so contributions do not count as gains. Final value above includes contributions.
              </p>
            )}
          </div>
        )}

        {tab === "Drawdown" && (
          <div className="space-y-3">
            <p className="text-sm text-body">
              Distance below the previous high, time-weighted.
              {m.maxDrawdown && ` Deepest: ${pct(m.maxDrawdown.depth)} from ${m.maxDrawdown.peak} to ${m.maxDrawdown.trough}, ${m.maxDrawdown.recovered ? `recovered ${m.maxDrawdown.recovered}` : "not yet recovered"}.`}
              {` Longest: ${Math.round(m.longestDrawdownDays)} days.`}
            </p>
            <LabChart
              dates={report.dates}
              series={[
                { label: run.name, values: underwater(own), tone: "loss", area: true },
                ...(benchGrowth ? [{ label: report.benchmark!.ticker, values: underwater(benchGrowth), tone: "muted" as const, dash: "6 4" }] : []),
              ]}
              format={(v) => pct(v, 0)}
              height={220}
              summary={`Drawdown chart. Deepest drawdown ${pct(m.maxDrawdown?.depth ?? 0)}.`}
            />
          </div>
        )}

        {tab === "Monthly" && <MonthlyTable run={run} />}
        {tab === "Holdings" && <HoldingsTable run={run} />}
        {tab === "Trades" && <TradesTable run={run} />}

        {tab === "Compare" && (
          compare.length < 2 ? (
            <p className="text-sm text-muted">Tick two or more runs in the run list to compare them here.</p>
          ) : (
            <div className="space-y-4">
              <LabChart
                dates={compare.reduce((a, r) => (r.report.dates.length > a.length ? r.report.dates : a), [] as string[])}
                series={compare.map((r, i) => {
                  const longest = compare.reduce((a, x) => (x.report.dates.length > a.length ? x.report.dates : a), [] as string[]);
                  const g = growth(r);
                  const byDate = new Map(r.report.dates.map((d, t) => [d, g[t]]));
                  return { label: `${r.id}. ${r.name}`, values: longest.map((d) => byDate.get(d) ?? NaN), dash: DASHES[i % DASHES.length] };
                })}
                log={log}
                format={(v) => `${v.toFixed(2)}×`}
                summary={`Growth of 1 for ${compare.length} runs.`}
              />
              <p className="text-xs text-muted">Growth of 1, time-weighted, so runs with different contributions line up.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
