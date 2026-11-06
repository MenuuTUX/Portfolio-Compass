"use client";

import { AlertTriangle } from "lucide-react";
import type { RobustnessResult, SweepDeflation } from "@/lib/lab/engine/sweep";
import { VARIANT_WARNING_AT } from "@/lib/lab/engine/variants";
import type { LabRun } from "./useLabEngine";
import { pct, signedPct } from "./format";
import LabChart from "./LabChart";
import { cn } from "@/lib/utils";

export type RobustnessState = { status: "running" } | { status: "error"; error: string } | { status: "done"; result: RobustnessResult };

/** Shown on results once many variants have been tried. States no statistic: only that selection flatters. */
export function VariantNotice({ count, className }: { count: number; className?: string }) {
  if (count < VARIANT_WARNING_AT) return null;
  return (
    <p role="note" className={cn("flex items-start gap-2 rounded-lg p-3 text-sm text-body ring-1 ring-hairline", className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
      <span>
        You have tried {count} variants. The best result among many tries is likely flattered: with enough variants, one will look good on this stretch of history by chance. Judge it on data it was not picked on, not on the number alone.
      </span>
    </p>
  );
}

const sharpeText = (s: number | null) => (s === null ? "n/a" : s.toFixed(2));

function SweepTable({ result, ownValue }: { result: RobustnessResult; ownValue: number }) {
  const sharpes = result.points.map((p) => p.sharpe).filter((s): s is number => s !== null);
  const top = Math.max(...sharpes.map(Math.abs), 0.01);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th scope="col" className="py-1 font-normal">Days</th>
          <th scope="col" className="py-1 font-normal">Growth per year</th>
          <th scope="col" className="py-1 font-normal">Sharpe</th>
          <th scope="col" className="py-1 text-right font-normal">Worst drop</th>
        </tr>
      </thead>
      <tbody>
        {result.points.map((p) => (
          <tr key={p.value} className="border-t border-hairline">
            <th scope="row" className="py-1.5 pr-3 text-left font-normal text-muted">
              <span className="font-mono text-ink">{p.value}</span>
              {p.value === ownValue && <span className="ml-1.5 text-xs">your run</span>}
              {p.value === result.bestValue && <span className="ml-1.5 text-xs text-ink">best</span>}
            </th>
            <td className="py-1.5 pr-3 font-mono text-ink">{signedPct(p.cagr)}</td>
            <td className="py-1.5 pr-3">
              <span className="flex items-center gap-2">
                <span className="w-9 font-mono text-ink">{sharpeText(p.sharpe)}</span>
                {p.sharpe !== null && (
                  <span aria-hidden className="h-2 w-24 rounded-sm bg-surface-soft">
                    <span
                      className={cn("block h-2 rounded-sm", p.sharpe >= 0 ? "bg-ink" : "bg-muted-soft")}
                      style={{ width: `${Math.max(2, (Math.abs(p.sharpe) / top) * 100)}%` }}
                    />
                  </span>
                )}
              </span>
            </td>
            <td className="py-1.5 text-right font-mono text-ink">{p.maxDrawdown === null ? "none" : pct(-Math.abs(p.maxDrawdown))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Deflation({ d }: { d: SweepDeflation }) {
  const chance = Math.round(d.probability * 100);
  const verdict =
    chance < 50
      ? "That is no better than luck would give."
      : chance < 90
        ? "That is not convincing yet."
        : "That holds up better, though it is still one history.";
  return (
    <div role="note" className="space-y-1 rounded-lg p-3 text-sm text-body ring-1 ring-hairline">
      <p>
        Allowing for the {d.trials} lengths tried, the chance the best one has a real edge is{" "}
        <span className="font-mono text-ink">{chance}%</span>. {verdict}
      </p>
      <p className="text-xs text-muted">
        The best length has a Sharpe of {d.bestSharpe.toFixed(2)}. The best of {d.trials} rules with no edge would show about {d.luckSharpe.toFixed(2)} by luck alone (deflated Sharpe). It counts only the lengths in this sweep, so every other variant you have tried makes the true chance lower.
      </p>
    </div>
  );
}

function WalkForward({ result }: { result: RobustnessResult }) {
  const wf = result.walkForward;
  if (!wf) {
    return (
      <p className="text-xs text-muted">
        Walk-forward needs at least 4 years of history (3 to choose, then 1 to test, twice over). This run is shorter, so it is skipped rather than shown on too little data.
      </p>
    );
  }
  const oos = wf.outOfSample;
  const ins = wf.inSampleBest;
  const rows: [string, (s: typeof oos) => string][] = [
    ["Growth per year", (s) => signedPct(s.cagr)],
    ["Sharpe", (s) => sharpeText(s.sharpe)],
    ["Worst drop", (s) => (s.maxDrawdown ? pct(-Math.abs(s.maxDrawdown.depth)) : "n/a")],
  ];
  const weaker = oos.sharpe === null || ins.sharpe === null || oos.sharpe < ins.sharpe - 0.15;
  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th scope="col" className="py-1 font-normal">&nbsp;</th>
            <th scope="col" className="py-1 font-normal">Best {ins.value} days, picked with hindsight</th>
            <th scope="col" className="py-1 font-normal">Walk-forward, out of sample</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label} className="border-t border-hairline">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal text-muted">{label}</th>
              <td className="py-1.5 font-mono text-ink">{f(ins)}</td>
              <td className="py-1.5 font-mono text-ink">{f(oos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">Both columns cover the same dates, {wf.dates[0]} to {wf.dates[wf.dates.length - 1]}.</p>
      <LabChart
        dates={wf.dates}
        series={[{ label: "Walk-forward, out of sample", values: wf.equity }]}
        format={(v) => `${v.toFixed(2)}×`}
        height={160}
        summary={`Growth of 1 on the stitched out-of-sample returns: ${wf.equity[wf.equity.length - 1].toFixed(2)}×.`}
      />
      <details className="text-xs text-muted">
        <summary className="cursor-pointer text-body">Which length each window picked ({wf.windows.length} windows)</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left">
              <th scope="col" className="py-1 font-normal">Tested</th>
              <th scope="col" className="py-1 font-normal">Picked</th>
              <th scope="col" className="py-1 font-normal">Sharpe when picked</th>
              <th scope="col" className="py-1 font-normal">Sharpe after</th>
            </tr>
          </thead>
          <tbody className="font-mono text-ink">
            {wf.windows.map((w) => (
              <tr key={w.testStart} className="border-t border-hairline">
                <td className="py-1">{w.testStart} to {w.testEnd}</td>
                <td className="py-1">{w.chosen} days</td>
                <td className="py-1">{sharpeText(w.trainSharpe)}</td>
                <td className="py-1">{sharpeText(w.testSharpe)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="text-xs text-muted">
        {weaker
          ? "Choosing the length on past years and applying it to the next year did worse than the hindsight pick. That gap is the part of the sweep result that was luck or fitting."
          : "Choosing on past years held up about as well as the hindsight pick here. That is encouraging for this rule on this data, not proof."}
      </p>
      <p className="text-xs text-muted">
        What this does: each window picks the length with the best Sharpe over {Math.round(wf.trainBars / 252)} years, then applies it to the next {Math.round(wf.testBars / 252)} year, and the test years are joined into one curve. What it does not: it is one path through one history, the list of lengths was chosen by us, and each length is simulated over the whole history, so a switch between windows pays no trading cost. It does not prove the rule will work going forward.
      </p>
    </div>
  );
}

interface Props {
  run: LabRun;
  variants: number;
  state: RobustnessState | undefined;
  onRun: () => void;
}

export default function RobustnessPanel({ run, variants, state, onRun }: Props) {
  const strategy = run.request.strategy;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-ink">Does the setting matter?</h3>
        <p className="mt-1 text-xs text-muted">
          Variants tried this session: <span className="font-mono text-ink">{variants}</span>. Each different strategy, setting or period counts once, including every value in a sweep.
        </p>
      </div>
      <VariantNotice count={variants} />

      {strategy.kind !== "trend" ? (
        <p className="text-sm text-muted">
          Sweeps and walk-forward tests work on the no-code trend rule, which has one setting to vary (the moving-average length). Code strategies and the other rules are not swept yet.
        </p>
      ) : (
        <>
          <p className="text-sm text-body">
            Runs the same rule with other moving-average lengths and shows whether the result depends on one lucky setting. Your run uses {strategy.smaDays} days.
          </p>
          {state?.status !== "done" && (
            <button type="button" className="ws-pill ws-pill-primary h-9 px-4" disabled={state?.status === "running"} onClick={onRun}>
              {state?.status === "running" ? "Running the sweep…" : "Run the sweep"}
            </button>
          )}
          {state?.status === "error" && <p role="alert" className="text-sm text-rose-400">{state.error}</p>}
          {state?.status === "done" && (
            <div className="space-y-5">
              <section aria-label="Parameter sweep" className="space-y-3 rounded-xl p-4 ring-1 ring-hairline">
                <h4 className="text-sm font-medium text-ink">Moving-average length, {state.result.startDate} to {state.result.endDate}</h4>
                <SweepTable result={state.result} ownValue={strategy.smaDays} />
                {state.result.deflated && <Deflation d={state.result.deflated} />}
                <p className="text-xs text-muted">
                  The best value in a sweep is optimistic: it was picked because it looked best on this history. If neighbouring lengths are close, the rule is not hanging on one setting. If only one stands out, treat it as luck until a test it was not picked on says otherwise.
                </p>
              </section>
              <section aria-label="Walk-forward test" className="space-y-3 rounded-xl p-4 ring-1 ring-hairline">
                <h4 className="text-sm font-medium text-ink">Walk-forward test</h4>
                <WalkForward result={state.result} />
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

