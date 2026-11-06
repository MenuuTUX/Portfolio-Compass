"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { m as motion } from "framer-motion";
import { BLANK_FORM, isGuided, LAB_ACK_KEY, LAB_FORM_KEY, startNoCode, toRequest, type LabForm } from "@/lib/lab/lab-form";
import { extractTickers, lessonById, liveNotes } from "@/lib/lab/lessons";
import { PaneResizer, RowResizer, useResizableWidth } from "@/components/workspace/PaneResizer";
import { EASE } from "@/components/motion/Reveal";
import { cn } from "@/lib/cn";
import StrategyPanel from "./StrategyPanel";
import GuidePanel from "./GuidePanel";
import ResultsPanel from "./ResultsPanel";
import RunsPanel from "./RunsPanel";
import { StrategyRunError, useLabEngine, type LabRun } from "./useLabEngine";
import { countVariants } from "@/lib/lab/engine/variants";
import type { RobustnessState } from "./RobustnessPanel";
import CodePane, { type ConsoleState } from "./CodePane";
import type { Params, StrategyError } from "@/lib/lab/strategy/types";

const MAX_COMPARE = 5;

const todayIso = () => new Date().toISOString().slice(0, 10);

const LG_QUERY = "(min-width: 1024px)";
function subscribeLg(callback: () => void) {
  const mq = window.matchMedia(LG_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
function useIsLg() {
  return useSyncExternalStore(subscribeLg, () => window.matchMedia(LG_QUERY).matches, () => false);
}

// Leaves the results below the editor at least 220px.
const maxCodeH = () => Math.max(160, window.innerHeight - 260);
const maxSide = () => Math.min(520, Math.round(window.innerWidth * 0.32));

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the Lab still works for this visit.
  }
}

function LabGate({ onEnter }: { onEnter: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <main className="ws-page flex min-h-dvh items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="ws-panel w-full max-w-lg space-y-5 p-6 sm:p-8"
      >
        <div className="flex items-center gap-2 text-muted">
          <FlaskConical className="h-5 w-5" aria-hidden />
          <span className="text-sm font-medium">Compass Lab</span>
        </div>
        <h1 className="text-2xl font-bold text-ink">Test an investing idea on past prices</h1>
        <div className="space-y-3 text-sm text-body">
          <p>
            The Lab replays an idea over past prices and shows what would have happened: how much the money grew, and how far it fell along the way.
            Short guided lessons teach you to write each rule in a few lines of Python, and no finance or coding background is needed. Prefer a form? Build rules without code, or write your own strategy once you are comfortable.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Every result is hypothetical. Past prices do not predict future returns.</li>
            <li>Backtests are easy to overfit. A rule tuned until it looks good on the past usually does worse afterwards.</li>
            <li>Nothing here is advice, and the Lab never places trades or connects to a broker.</li>
            <li>Your strategies stay in this browser. Tickers go to the server to fetch prices, as elsewhere on the site.</li>
          </ul>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-ink">
          <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          I understand these results are hypothetical and not advice.
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ws-pill ws-pill-primary h-10 px-5" disabled={!agreed} onClick={onEnter}>
            Open the Lab
          </button>
          <Link href="/" className="ws-pill h-10 px-5">Back to Portfolio Compass</Link>
        </div>
      </motion.div>
    </main>
  );
}

type MobilePane = "strategy" | "code" | "results" | "runs";

/** Wait this long after the last keystroke before reading params from the code. */
const INSPECT_DELAY_MS = 600;
const SAVE_DELAY_MS = 400;

export default function LabApp() {
  const [acked, setAcked] = useState<boolean | null>(null);
  const [form, setForm] = useState<LabForm>(BLANK_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [runs, setRuns] = useState<LabRun[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [robustness, setRobustness] = useState<Record<number, RobustnessState>>({});
  const [sweepHashes, setSweepHashes] = useState<string[]>([]);
  const [pane, setPane] = useState<MobilePane>("strategy");
  const [center, setCenter] = useState<"code" | "results">("code");
  const [consoleState, setConsoleState] = useState<ConsoleState>({ logs: [], error: null });
  const [params, setParams] = useState<Params | null>(null);
  const [paramsError, setParamsError] = useState<StrategyError | null>(null);
  const [pythonUsed, setPythonUsed] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { status, pythonStatus, run, robustness: sweep, inspect } = useLabEngine();
  const isLg = useIsLg();
  const left = useResizableWidth("lab-left", 340, 280, maxSide);
  const right = useResizableWidth("lab-right", 300, 240, maxSide);
  const codeH = useResizableWidth("lab-code-h", 300, 160, maxCodeH);

  useEffect(() => {
    // Read after mount so the server render and first client render match.
    setAcked(read(LAB_ACK_KEY) === "1");
    const saved = read(LAB_FORM_KEY);
    if (saved) {
      try {
        // The end date is always today: a saved end would backtest to an old date.
        setForm({ ...BLANK_FORM, ...JSON.parse(saved), end: todayIso() });
      } catch {
        // A corrupt draft is dropped.
      }
    } else {
      // First visit: a no-code strategy, so nothing heavy downloads before the user asks for code.
      setForm(startNoCode());
    }
  }, []);

  const updateForm = useCallback((next: LabForm) => {
    setForm(next);
    setErrors([]);
    // Debounced: code changes on every keystroke.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => write(LAB_FORM_KEY, JSON.stringify(next)), SAVE_DELAY_MS);
  }, []);

  const busy = status === "loading-data" || status === "strategy" || status === "running" || status === "starting";

  // Read params from the code after typing stops. Python is read on wide screens
  // (where the editor already implies Python will load) or once it has run;
  // phones never download Python just to fill the params panel.
  const shouldInspect = form.mode === "code" && (form.language === "typescript" || isLg || pythonUsed);
  useEffect(() => {
    if (!shouldInspect || status === "starting") return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void inspect(form.language, form.code).then((r) => {
        if (cancelled) return;
        setParams(r.params);
        setParamsError(r.error ?? null);
      });
    }, INSPECT_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shouldInspect, form.language, form.code, inspect, status]);

  const runNow = useCallback(async (override?: LabForm) => {
    if (busy) return;
    const target = override ?? form;
    const built = toRequest(target);
    if ("errors" in built) {
      setErrors(built.errors);
      return;
    }
    setErrors([]);
    const isCode = target.mode === "code";
    if (isCode && target.language === "python") setPythonUsed(true);
    try {
      const result = await run(target.name.trim() || "Untitled strategy", built.request);
      setRuns((prev) => [...prev, result]);
      setSelectedId(result.id);
      setConsoleState({ logs: result.logs, error: null, lookahead: result.lookahead, strategyMs: result.strategyMs });
      setCenter("results");
      setPane("results");
    } catch (error) {
      if (error instanceof StrategyRunError) {
        setConsoleState({ logs: error.logs, error: error.detail });
        setCenter("code");
        setPane("code");
      }
      setErrors([error instanceof Error ? error.message : String(error)]);
    }
  }, [busy, form, run]);

  const runRobustness = useCallback(async (target: LabRun) => {
    setRobustness((prev) => ({ ...prev, [target.id]: { status: "running" } }));
    try {
      const result = await sweep(target);
      setSweepHashes((prev) => [...prev, ...result.points.map((p) => p.hash)]);
      setRobustness((prev) => ({ ...prev, [target.id]: { status: "done", result } }));
    } catch (error) {
      setRobustness((prev) => ({ ...prev, [target.id]: { status: "error", error: error instanceof Error ? error.message : String(error) } }));
    }
  }, [sweep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void runNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runNow]);

  if (acked === null) {
    // Same page and title as the loaded Lab, so the wait does not look blank.
    return (
      <main className="ws-page flex min-h-dvh flex-col gap-2 p-2" aria-busy="true">
        <header className="flex h-11 shrink-0 items-center gap-3 px-2">
          <FlaskConical className="h-4 w-4 text-muted" aria-hidden />
          <h1 className="text-sm font-semibold text-ink">Compass Lab</h1>
        </header>
      </main>
    );
  }
  if (!acked) {
    return (
      <LabGate
        onEnter={() => {
          write(LAB_ACK_KEY, "1");
          setAcked(true);
        }}
      />
    );
  }

  const selected = runs.find((r) => r.id === selectedId) ?? null;
  const compare = runs.filter((r) => compareIds.includes(r.id));
  const toggleCompare = (id: number) =>
    setCompareIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX_COMPARE)));

  const codeMode = form.mode === "code";
  const guided = isGuided(form);
  const lesson = guided ? lessonById(form.lessonId) : null;
  const strategy = guided ? (
    <GuidePanel
      form={form}
      onChange={updateForm}
      onRunWith={(next) => {
        updateForm(next);
        void runNow(next);
      }}
      onRun={() => void runNow()}
      running={busy}
      errors={errors}
      pythonStatus={pythonStatus}
    />
  ) : (
    <StrategyPanel form={form} onChange={updateForm} onRun={() => void runNow()} running={busy} errors={errors} params={params} paramsError={paramsError} />
  );
  const variants = countVariants(runs.map((r) => r.report.hash), sweepHashes);
  const results = (
    <ResultsPanel
      run={selected}
      compare={compare}
      guided={guided}
      variants={variants}
      robustness={selected ? robustness[selected.id] : undefined}
      onRobustness={(r) => void runRobustness(r)}
    />
  );
  const codePane = (
    <CodePane
      wide={isLg}
      language={form.language}
      code={form.code}
      // Guided code names its own tickers, so the universe follows what is typed.
      onChange={(code) => updateForm(guided ? { ...form, code, universe: extractTickers(code) } : { ...form, code })}
      onRun={() => void runNow()}
      console={consoleState}
      pythonStatus={pythonStatus}
      highlightLines={lesson ? liveNotes(lesson, form.code).map((n) => n.line) : undefined}
      compact={guided && isLg}
    />
  );
  const mobilePanes = codeMode
    ? ([["strategy", "Strategy"], ["code", "Code"], ["results", "Results"], ["runs", "Metrics"]] as const)
    : ([["strategy", "Strategy"], ["results", "Results"], ["runs", "Metrics"]] as const);
  const runList = (
    <RunsPanel runs={runs} selectedId={selectedId} compareIds={compareIds} onSelect={setSelectedId} onToggleCompare={toggleCompare} />
  );

  return (
    <main className="ws-page flex h-dvh flex-col gap-2 p-2">
      <header className="flex h-11 shrink-0 items-center gap-3 px-2">
        <Link href="/" className="ws-icon-btn" aria-label="Back to Portfolio Compass">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <FlaskConical className="h-4 w-4 text-muted" aria-hidden />
        <h1 className="text-sm font-semibold text-ink">Compass Lab</h1>
        <span className="hidden text-xs text-muted sm:inline">Backtests on past prices. Hypothetical, not advice.</span>
      </header>

      {/* Desktop: three panes. Only one layout renders, so form ids stay unique. */}
      {isLg ? (
      <div className="flex min-h-0 flex-1">
        <section aria-label="Strategy" className="ws-panel min-h-0 shrink-0 overflow-y-auto custom-scrollbar" style={{ width: left.width }}>
          {strategy}
        </section>
        <PaneResizer label="Resize strategy panel" width={left.width} direction={1} onResize={left.setWidth} onCommit={left.persist} onDraggingChange={left.setDragging} onReset={left.reset} />
        <section aria-label={codeMode ? "Code and results" : "Results"} className="ws-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {guided ? (
            // Beginners see code and results together: write on top, watch the outcome below.
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0" style={{ height: codeH.width }}>{codePane}</div>
              <RowResizer label="Resize code and results" height={codeH.width} direction={1} onResize={codeH.setWidth} onCommit={codeH.persist} onDraggingChange={codeH.setDragging} onReset={codeH.reset} />
              <div className="min-h-0 flex-1 border-t border-hairline">{results}</div>
            </div>
          ) : codeMode ? (
            <>
              <div role="tablist" aria-label="Center pane" className="flex shrink-0 gap-1 border-b border-hairline px-3 pt-2">
                {([["code", "Code"], ["results", "Results"]] as const).map(([id, text]) => (
                  <button
                    key={id}
                    role="tab"
                    type="button"
                    aria-selected={center === id}
                    onClick={() => setCenter(id)}
                    className={cn("relative h-9 px-3 text-sm font-medium", center === id ? "text-ink" : "text-muted hover:text-ink")}
                  >
                    {text}
                    {center === id && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-ink" />}
                  </button>
                ))}
              </div>
              {/* Both stay mounted so the editor keeps its state while results are shown. */}
              <div className={cn("min-h-0 flex-1", center !== "code" && "hidden")}>{codePane}</div>
              <div className={cn("min-h-0 flex-1", center !== "results" && "hidden")}>{results}</div>
            </>
          ) : (
            results
          )}
        </section>
        <PaneResizer label="Resize runs panel" width={right.width} direction={-1} onResize={right.setWidth} onCommit={right.persist} onDraggingChange={right.setDragging} onReset={right.reset} />
        <section aria-label="Metrics and runs" className="ws-panel min-h-0 shrink-0 overflow-y-auto custom-scrollbar" style={{ width: right.width }}>
          {runList}
        </section>
      </div>

      ) : (
      /* Mobile and tablet: one pane at a time, with labelled tabs. */
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div role="tablist" aria-label="Lab panes" className={cn("grid shrink-0 gap-1 rounded-lg bg-surface-soft p-1", codeMode ? "grid-cols-4" : "grid-cols-3")}>
          {mobilePanes.map(([id, text]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={pane === id}
              onClick={() => setPane(id)}
              className={cn("h-9 rounded-md text-sm font-medium", pane === id ? "bg-[var(--panel)] text-ink ring-1 ring-hairline" : "text-muted")}
            >
              {text}
            </button>
          ))}
        </div>
        <section className="ws-panel min-h-0 flex-1 overflow-y-auto custom-scrollbar" role="tabpanel">
          {pane === "strategy"
            ? strategy
            : pane === "code" && codeMode
              ? <div className="h-full min-h-[480px]">{codePane}</div>
              : pane === "results" || pane === "code"
                ? <div className="h-full min-h-[480px]">{results}</div>
                : runList}
        </section>
      </div>
      )}

    </main>
  );
}
