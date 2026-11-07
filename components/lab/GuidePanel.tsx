"use client";

import { RotateCcw } from "lucide-react";
import { applyLesson, type LabForm } from "@/lib/lab/lab-form";
import { applyTweak, extractTickers, lessonById, LESSONS, liveNotes, setupText } from "@/lib/lab/lessons";
import { cn } from "@/lib/cn";
import ModeSwitch from "./ModeSwitch";

const field =
  "h-9 w-full rounded-md bg-surface-soft px-2.5 text-sm text-ink ring-1 ring-hairline focus-visible:outline-2 focus-visible:outline-compass";
const label = "block text-xs font-medium text-muted mb-1";

const TOOLS: [call: string, text: string][] = [
  ['day.adj_price("SPY")', "today's closing price, adjusted for splits and dividends"],
  ['day.price("SPY")', "today's closing price, split-adjusted only (for price levels)"],
  ['day.average("SPY", 50)', "average price over the last 50 days"],
  ['day.change("SPY", 126)', "growth over the last 126 days (0.05 = up 5%)"],
  ['day.high("SPY", 252)', "highest close of the last 252 days"],
  ['day.low("SPY", 252)', "lowest close of the last 252 days"],
  ['day.rsi("SPY")', "0 to 100; under 30 means it fell fast"],
];

interface GuidePanelProps {
  form: LabForm;
  onChange: (next: LabForm) => void;
  /** Apply a changed form and run it straight away. */
  onRunWith: (next: LabForm) => void;
  onRun: () => void;
  running: boolean;
  errors: string[];
  pythonStatus: string | null;
}

export default function GuidePanel({ form, onChange, onRunWith, onRun, running, errors, pythonStatus }: GuidePanelProps) {
  const lesson = lessonById(form.lessonId) ?? LESSONS[0];
  const index = LESSONS.indexOf(lesson);
  const edited = form.code !== lesson.code;
  const notes = liveNotes(lesson, form.code);
  const set = <K extends keyof LabForm>(key: K, value: LabForm[K]) => onChange({ ...form, [key]: value });

  const open = (i: number) => {
    if (LESSONS[i] === lesson) return;
    if (edited && !window.confirm("Switching lessons replaces the code you edited. Continue?")) return;
    onChange(applyLesson(form, LESSONS[i]));
  };

  return (
    <form
      className="flex min-h-full flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onRun();
      }}
    >
      <section className="space-y-3 px-4 pt-4">
        <ModeSwitch form={form} onChange={onChange} />
        <nav aria-label="Lessons" className="flex flex-wrap gap-1.5">
          {LESSONS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              aria-current={i === index ? "step" : undefined}
              aria-label={`Lesson ${i + 1}: ${l.title}`}
              title={l.title}
              onClick={() => open(i)}
              className={cn(
                "h-8 min-w-8 rounded-md px-2 font-mono text-xs font-semibold ring-1 transition-colors duration-75",
                i === index ? "bg-ink text-canvas ring-ink" : "text-muted ring-hairline hover:text-ink",
              )}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      </section>

      <section className="space-y-2 px-4 pt-4">
        <p className="text-xs font-medium text-compass">Lesson {index + 1} of {LESSONS.length}</p>
        <h2 className="text-lg font-bold text-ink">{lesson.title}</h2>
        <p className="text-xs text-muted">{lesson.subtitle}</p>
        <p className="text-sm text-body">{lesson.idea}</p>
        <p className="text-xs text-muted">
          Uses <span className="font-mono text-body">{form.universe.join(", ") || "no tickers yet"}</span>.{" "}
          {setupText(lesson, form.initialCash)}
        </p>
      </section>

      {notes.length > 0 && (
        <section className="space-y-2 px-4 pt-4" aria-label="Read the code">
          <h3 className="text-sm font-semibold text-ink">Read the code</h3>
          <ol className="space-y-2">
            {notes.map((n) => (
              <li key={`${n.line}-${n.match}`} className="flex gap-2 text-sm text-body">
                <span className="mt-0.5 h-5 shrink-0 rounded bg-surface-soft px-1.5 font-mono text-xs leading-5 text-body-strong">line {n.line}</span>
                <span>{n.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="space-y-2 px-4 pt-4" aria-label="Try this">
        <h3 className="text-sm font-semibold text-ink">Try this</h3>
        <div className="flex flex-wrap gap-2">
          {lesson.tweaks.map((t) => {
            const next = applyTweak(form.code, t);
            return (
              <button
                key={t.label}
                type="button"
                className="ws-chip"
                disabled={running || next === null}
                title={next === null ? "This part of the code has changed" : "Edits the code and runs it"}
                onClick={() => next && onRunWith({ ...form, code: next, universe: extractTickers(next), name: `${lesson.title}: ${t.label}` })}
              >
                {t.label}
              </button>
            );
          })}
          {edited && (
            <button type="button" className="ws-chip" onClick={() => onChange(applyLesson(form, lesson))}>
              <RotateCcw className="mr-1 inline h-3 w-3" aria-hidden /> Reset code
            </button>
          )}
        </div>
        <p className="text-xs text-muted">Or edit the code yourself, then press Run.</p>
      </section>

      <details className="group mx-4 mt-4 rounded-lg ring-1 ring-hairline">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-ink">What can day do?</summary>
        <ul className="space-y-1.5 px-3 pb-3">
          {TOOLS.map(([call, text]) => (
            <li key={call} className="text-xs text-body">
              <code className="font-mono text-ink">{call}</code> <span className="text-muted">{text}</span>
            </li>
          ))}
          <li className="pt-1 text-xs text-muted">Return a ticker (&quot;SPY&quot;), a list ([&quot;SPY&quot;, &quot;QQQ&quot;] for an even split), weights ({"{"}&quot;SPY&quot;: 0.6, &quot;AGG&quot;: 0.4{"}"}), or None for cash.</li>
        </ul>
      </details>

      <details className="mx-4 mt-3 rounded-lg ring-1 ring-hairline">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-ink">Change the setup</summary>
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          <div>
            <label htmlFor="g-start" className={label}>Start</label>
            <input id="g-start" type="date" className={field} value={form.start} onChange={(e) => set("start", e.target.value)} />
          </div>
          <div>
            <label htmlFor="g-end" className={label}>End</label>
            <input id="g-end" type="date" className={field} value={form.end} onChange={(e) => set("end", e.target.value)} />
          </div>
          <div>
            <label htmlFor="g-cash" className={label}>Starting amount (USD)</label>
            <input
              id="g-cash"
              type="number"
              inputMode="decimal"
              className={cn(field, "font-mono")}
              value={Number.isFinite(form.initialCash) ? form.initialCash : ""}
              onChange={(e) => set("initialCash", e.target.value === "" ? NaN : Number(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor="g-bench" className={label}>Compare with</label>
            <input id="g-bench" className={cn(field, "font-mono uppercase")} value={form.benchmark} onChange={(e) => set("benchmark", e.target.value)} />
          </div>
          <p className="col-span-2 text-xs text-muted">
            Fees, slippage and dividends use fixed defaults here. Switch to Code mode for full control.
          </p>
        </div>
      </details>

      <div className="mt-auto sticky bottom-0 space-y-2 border-t border-hairline bg-[var(--panel)] px-4 py-3">
        {errors.length > 0 && (
          <ul role="alert" className="space-y-1 text-xs text-rose-400">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        <button type="submit" className="ws-pill ws-pill-primary h-10 w-full" disabled={running}>
          {running ? "Running…" : "Run it"}
          <kbd className="ml-2 hidden text-[10px] opacity-60 sm:inline">⌘↵</kbd>
        </button>
        <p className="text-center text-xs text-muted" aria-live="polite">
          {pythonStatus && pythonStatus !== "Python ready" ? pythonStatus : "The first run downloads Python (about 14 MB), once."}
        </p>
      </div>
    </form>
  );
}
