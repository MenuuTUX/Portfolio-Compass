"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { loadPortfolio } from "@/lib/storage";
import { indexedDbBarStore, loadBars } from "@/lib/lab/bar-cache";
import { rowsFromPortfolio, TEMPLATES, toRequest, type LabForm, type PortfolioBasis, type RebalanceChoice } from "@/lib/lab/lab-form";
import { strategyTickers } from "@/lib/lab/no-code";
import { noCodeToSource } from "@/lib/lab/strategy/templates";
import type { Params, StrategyError, StrategyLanguage } from "@/lib/lab/strategy/types";
import { cn } from "@/lib/utils";
import CodeSettings from "./CodeSettings";

const field =
  "h-9 w-full rounded-md bg-surface-soft px-2.5 text-sm text-ink ring-1 ring-hairline focus-visible:outline-2 focus-visible:outline-compass";
const label = "block text-xs font-medium text-muted mb-1";

function Num({
  id, value, onChange, min, step, suffix,
}: { id: string; value: number; onChange: (v: number) => void; min?: number; step?: number; suffix?: string }) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={cn(field, suffix && "pr-10", "font-mono")}
        value={Number.isFinite(value) ? value : ""}
        min={min}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      />
      {suffix && <span className="pointer-events-none absolute right-2.5 top-2 text-xs text-muted">{suffix}</span>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-hairline px-4 py-4 first:border-t-0">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

interface StrategyPanelProps {
  form: LabForm;
  onChange: (next: LabForm) => void;
  onRun: () => void;
  running: boolean;
  errors: string[];
  params: Params | null;
  paramsError: StrategyError | null;
}

export default function StrategyPanel({ form, onChange, onRun, running, errors, params, paramsError }: StrategyPanelProps) {
  const set = <K extends keyof LabForm>(key: K, value: LabForm[K]) => onChange({ ...form, [key]: value });
  const weightTotal = form.rows.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0);
  const code = form.mode === "code";
  const usesWeights = !code && form.kind !== "momentum";
  // Code mode edits its own universe; no-code edits the rule's rows. Blank rows stay while typing.
  const list = code ? form.universe.map((ticker) => ({ ticker, weight: 0 })) : form.rows;
  const setList = (next: typeof list) =>
    onChange(code ? { ...form, universe: next.map((r) => r.ticker) } : { ...form, rows: next });

  const [note, setNote] = useState<string | null>(null);

  const importPortfolio = async () => {
    const items = loadPortfolio();
    if (items.length === 0) {
      setNote("Your portfolio is empty. Add holdings on the Portfolio tab first.");
      return;
    }
    setNote("Reading your holdings…");
    // Latest closes turn share counts into value weights; without them the import falls back to targets.
    const lastClose: Record<string, number> = {};
    let asOf = "";
    if (items.every((i) => i.shares > 0)) {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
      try {
        // Same cache as a run, so importing warms the data the next backtest needs.
        const { series } = await loadBars(items.map((i) => i.ticker.toUpperCase()), start, end, { store: indexedDbBarStore() });
        for (const s of series) {
          const bar = s.bars.at(-1);
          if (bar) {
            lastClose[s.ticker] = bar.close;
            asOf = bar.date > asOf ? bar.date : asOf;
          }
        }
      } catch {
        // Prices unavailable: fall through to target weights.
      }
    }
    const { rows, basis } = rowsFromPortfolio(items, lastClose);
    const why: Record<PortfolioBasis, string> = {
      value: `Weights from your share counts at the ${asOf} close.`,
      target: "Weights from your target allocation on the Portfolio tab.",
      equal: "Your portfolio has no share counts or target weights, so each holding gets an equal weight.",
    };
    setNote(why[basis]);
    onChange({ ...form, name: "My portfolio", kind: "fixed", rows, rebalance: "on-change" });
  };

  /** Turn the current no-code rule into equivalent code, keeping every other setting. */
  const viewAsCode = (language: StrategyLanguage) => {
    const built = toRequest({ ...form, mode: "no-code" });
    if ("errors" in built) return setNote(built.errors[0]);
    const rule = built.request.strategy;
    if (rule.kind === "code") return;
    onChange({
      ...form,
      mode: "code",
      language,
      code: noCodeToSource(rule, language),
      universe: strategyTickers(rule),
      paramOverrides: {},
      strategyId: null,
      name: form.name.endsWith(" (code)") ? form.name : `${form.name} (code)`,
    });
  };

  return (
    <form
      className="flex flex-col"
      // toRequest validates in plain words; native step/min checks would block valid amounts like 10000.
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onRun();
      }}
    >
      <section className="px-4 pt-4">
        <div role="radiogroup" aria-label="Strategy type" className="grid grid-cols-2 gap-1 rounded-lg bg-surface-soft p-1">
          {([["no-code", "No-code"], ["code", "Code"]] as const).map(([k, text]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={form.mode === k}
              onClick={() => set("mode", k)}
              className={cn(
                "h-8 rounded-md text-xs font-semibold transition-colors duration-75",
                form.mode === k ? "bg-[var(--panel)] text-ink ring-1 ring-hairline" : "text-muted hover:text-ink",
              )}
            >
              {text}
            </button>
          ))}
        </div>
      </section>

      {code ? (
        <>
          <section className="px-4 pt-4">
            <label htmlFor="lab-name" className={label}>Name</label>
            <input id="lab-name" className={field} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </section>
          <CodeSettings form={form} onChange={onChange} params={params} paramsError={paramsError} />
        </>
      ) : (
      <>
      <Section title="Start from">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ws-chip" onClick={() => void importPortfolio()}>My portfolio</button>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="ws-chip"
              title={t.description}
              onClick={() => onChange({ ...form, ...t.form() })}
            >
              {t.label}
            </button>
          ))}
        </div>
        {note && <p className="text-xs text-body" role="status">{note}</p>}
        <div>
          <label htmlFor="lab-name" className={label}>Name</label>
          <input id="lab-name" className={field} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
      </Section>

      <Section title="Rule">
        <div role="radiogroup" aria-label="Strategy rule" className="grid grid-cols-3 gap-1 rounded-lg bg-surface-soft p-1">
          {([
            ["fixed", "Fixed mix"],
            ["trend", "Trend filter"],
            ["momentum", "Momentum"],
          ] as const).map(([k, text]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={form.kind === k}
              onClick={() => set("kind", k)}
              className={cn(
                "h-8 rounded-md text-xs font-semibold transition-colors duration-75",
                form.kind === k ? "bg-[var(--panel)] text-ink ring-1 ring-hairline" : "text-muted hover:text-ink",
              )}
            >
              {text}
            </button>
          ))}
        </div>
        <p className="text-xs text-body">
          {form.kind === "fixed" && "Holds the weights below and rebalances by the schedule you pick."}
          {form.kind === "trend" && "Holds each asset while its adjusted close is above its moving average. Below it, that weight moves to the safe asset or cash."}
          {form.kind === "momentum" && "Equal-weights the assets with the highest trailing return. With the absolute check on, a loser goes to the safe asset or cash."}
        </p>
        {form.kind === "trend" && (
          <div>
            <label htmlFor="lab-sma" className={label}>Moving average</label>
            <Num id="lab-sma" value={form.smaDays} min={2} step={1} suffix="days" onChange={(v) => set("smaDays", v)} />
          </div>
        )}
        {form.kind === "momentum" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="lab-lookback" className={label}>Lookback</label>
              <Num id="lab-lookback" value={form.lookbackDays} min={1} step={1} suffix="days" onChange={(v) => set("lookbackDays", v)} />
            </div>
            <div>
              <label htmlFor="lab-top" className={label}>Hold top</label>
              <Num id="lab-top" value={form.top} min={1} step={1} onChange={(v) => set("top", v)} />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-body">
              <input type="checkbox" checked={form.absolute} onChange={(e) => set("absolute", e.target.checked)} />
              Absolute check: skip assets with a negative return
            </label>
          </div>
        )}
        {form.kind !== "fixed" && (
          <div>
            <label htmlFor="lab-safe" className={label}>Safe asset (blank for cash)</label>
            <input id="lab-safe" className={cn(field, "font-mono uppercase")} value={form.safe} placeholder="SHY" onChange={(e) => set("safe", e.target.value)} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          View as code:
          <button type="button" className="ws-chip" onClick={() => viewAsCode("python")}>Python</button>
          <button type="button" className="ws-chip" onClick={() => viewAsCode("typescript")}>TypeScript</button>
        </div>
      </Section>
      </>
      )}

      <Section title={code ? "Universe" : usesWeights ? "Assets and weights" : "Assets to rank"}>
        {code && <p className="text-xs text-body">The tickers your code receives as columns of <code className="font-mono">prices</code>. The benchmark is added separately.</p>}
        <ul className="space-y-2">
          {list.map((row, i) => (
            <li key={i} className="flex gap-2">
              <input
                aria-label={`Ticker ${i + 1}`}
                className={cn(field, "font-mono uppercase")}
                value={row.ticker}
                placeholder="Ticker"
                onChange={(e) => setList(list.map((r, k) => (k === i ? { ...r, ticker: e.target.value } : r)))}
              />
              {usesWeights && (
                <div className="w-28 shrink-0">
                  <Num
                    id={`lab-w-${i}`}
                    value={row.weight}
                    min={0}
                    step={1}
                    suffix="%"
                    onChange={(v) => setList(list.map((r, k) => (k === i ? { ...r, weight: v } : r)))}
                  />
                </div>
              )}
              <button
                type="button"
                className="ws-icon-btn shrink-0"
                aria-label={`Remove ${row.ticker || `row ${i + 1}`}`}
                onClick={() => setList(list.filter((_, k) => k !== i))}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between">
          <button type="button" className="ws-pill" onClick={() => setList([...list, { ticker: "", weight: 0 }])}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add ticker
          </button>
          {usesWeights && (
            <span className={cn("text-xs font-mono", weightTotal > 100.0001 ? "text-rose-400" : "text-muted")}>
              Total {weightTotal.toFixed(1)}%{weightTotal < 99.9999 ? `, ${(100 - weightTotal).toFixed(1)}% cash` : ""}
            </span>
          )}
        </div>
      </Section>

      <Section title="Period and benchmark">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="lab-start" className={label}>Start</label>
            <input id="lab-start" type="date" className={field} value={form.start} onChange={(e) => set("start", e.target.value)} />
          </div>
          <div>
            <label htmlFor="lab-end" className={label}>End</label>
            <input id="lab-end" type="date" className={field} value={form.end} onChange={(e) => set("end", e.target.value)} />
          </div>
          <div>
            <label htmlFor="lab-bench" className={label}>Benchmark</label>
            <input id="lab-bench" className={cn(field, "font-mono uppercase")} value={form.benchmark} placeholder="SPY" onChange={(e) => set("benchmark", e.target.value)} />
          </div>
          <div>
            <label htmlFor="lab-cash" className={label}>Starting amount (USD)</label>
            <Num id="lab-cash" value={form.initialCash} min={1} step={1000} onChange={(v) => set("initialCash", v)} />
          </div>
        </div>
      </Section>

      <Section title="Rebalancing and cash flows">
        <div>
          <label htmlFor="lab-rebalance" className={label}>Rebalance</label>
          <select id="lab-rebalance" className={field} value={form.rebalance} onChange={(e) => set("rebalance", e.target.value as RebalanceChoice)}>
            <option value="on-change">Only when targets change</option>
            <option value="W">Weekly</option>
            <option value="M">Monthly</option>
            <option value="Q">Quarterly</option>
            <option value="Y">Yearly</option>
            <option value="drift">When a weight drifts past a band</option>
          </select>
        </div>
        {form.rebalance === "drift" && (
          <div>
            <label htmlFor="lab-band" className={label}>Band</label>
            <Num id="lab-band" value={form.band} min={0.1} step={0.5} suffix="pts" onChange={(v) => set("band", v)} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="lab-flow" className={label}>Add (or withdraw, negative)</label>
            <Num id="lab-flow" value={form.contribution} step={100} onChange={(v) => set("contribution", v)} />
          </div>
          <div>
            <label htmlFor="lab-flow-every" className={label}>Every</label>
            <select id="lab-flow-every" className={field} value={form.contributionEvery} onChange={(e) => set("contributionEvery", e.target.value as LabForm["contributionEvery"])}>
              <option value="M">Month</option>
              <option value="Q">Quarter</option>
              <option value="Y">Year</option>
            </select>
          </div>
        </div>
      </Section>

      <Section title="Costs and execution">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="lab-slip" className={label}>Slippage</label>
            <Num id="lab-slip" value={form.slippageBps} min={0} step={1} suffix="bps" onChange={(v) => set("slippageBps", v)} />
          </div>
          <div>
            <label htmlFor="lab-comm" className={label}>Commission</label>
            <Num id="lab-comm" value={form.commissionBps} min={0} step={1} suffix="bps" onChange={(v) => set("commissionBps", v)} />
          </div>
          <div>
            <label htmlFor="lab-min" className={label}>Minimum</label>
            <Num id="lab-min" value={form.minCommission} min={0} step={1} suffix="$" onChange={(v) => set("minCommission", v)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label htmlFor="lab-fill" className={label}>Fill at</label>
            <select id="lab-fill" className={field} value={form.fill} onChange={(e) => set("fill", e.target.value as LabForm["fill"])}>
              <option value="next-open">Next open</option>
              <option value="next-close">Next close</option>
            </select>
          </div>
          <div>
            <label htmlFor="lab-shares" className={label}>Shares</label>
            <select id="lab-shares" className={field} value={form.shares} onChange={(e) => set("shares", e.target.value as LabForm["shares"])}>
              <option value="fractional">Fractional</option>
              <option value="whole">Whole</option>
            </select>
          </div>
          <div>
            <label htmlFor="lab-divs" className={label}>Dividends</label>
            <select id="lab-divs" className={field} value={form.dividends} onChange={(e) => set("dividends", e.target.value as LabForm["dividends"])}>
              <option value="reinvest">Reinvest</option>
              <option value="cash">Keep as cash</option>
            </select>
          </div>
        </div>
      </Section>

      <div className="sticky bottom-0 space-y-2 border-t border-hairline bg-[var(--panel)] px-4 py-3">
        {errors.length > 0 && (
          <ul role="alert" className="space-y-1 text-xs text-rose-400">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        <button type="submit" className="ws-pill ws-pill-primary w-full h-10" disabled={running}>
          {running ? "Running…" : "Run backtest"}
          <kbd className="ml-2 hidden text-[10px] opacity-60 sm:inline">⌘↵</kbd>
        </button>
      </div>
    </form>
  );
}
