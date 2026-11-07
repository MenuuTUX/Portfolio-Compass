"use client";

import dynamic from "next/dynamic";
import { AlertTriangle, CheckCircle2, Terminal } from "lucide-react";
import type { LookaheadResult, StrategyError, StrategyLanguage } from "@/lib/lab/strategy/types";
import { cn } from "@/lib/cn";
import { RowResizer, useResizableWidth } from "@/components/ui/PaneResizer";

const maxConsole = () => Math.max(120, Math.round(window.innerHeight * 0.6));

// Monaco and its React wrapper load only when this pane renders on a wide
// screen. Phones get a plain textarea: the editor is several MB and poor on touch.
const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => <div className="ws-skeleton h-full w-full" aria-label="Loading editor" />,
});

export interface ConsoleState {
  logs: string[];
  error: StrategyError | null;
  lookahead?: LookaheadResult;
  strategyMs?: number;
}

interface CodePaneProps {
  wide: boolean;
  language: StrategyLanguage;
  code: string;
  onChange: (code: string) => void;
  onRun: () => void;
  console: ConsoleState;
  pythonStatus: string | null;
  highlightLines?: number[];
  /** Shorter console, for the guided layout where results share the column. */
  compact?: boolean;
}

export default function CodePane({ wide, language, code, onChange, onRun, console: out, pythonStatus, highlightLines, compact }: CodePaneProps) {
  const file = language === "python" ? "strategy.py" : "strategy.ts";
  const consoleH = useResizableWidth("lab-console-h", compact ? 112 : 176, 48, maxConsole);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        {wide ? (
          <CodeEditor language={language} value={code} onChange={onChange} error={out.error} onRun={onRun} highlightLines={highlightLines} />
        ) : (
          <textarea
            aria-label={`Strategy code, ${file}`}
            className="h-full min-h-[320px] w-full resize-none bg-transparent p-3 font-[ui-monospace,Menlo,monospace] text-[13px] leading-5 text-ink focus-visible:outline-2 focus-visible:outline-compass"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            value={code}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>

      <RowResizer label="Resize console" height={consoleH.width} direction={-1} onResize={consoleH.setWidth} onCommit={consoleH.persist} onDraggingChange={consoleH.setDragging} onReset={consoleH.reset} />
      <section aria-label="Console" className="flex shrink-0 flex-col border-t border-hairline" style={{ height: consoleH.width }}>
        <div className="flex h-8 shrink-0 items-center gap-2 px-3 text-xs text-muted">
          <Terminal className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium text-body">Console</span>
          <span className="font-mono">{file}</span>
          {language === "python" && pythonStatus && <span className="ml-auto">{pythonStatus}</span>}
          {out.strategyMs !== undefined && <span className={cn(language !== "python" || !pythonStatus ? "ml-auto" : "", "font-mono")}>weights() {out.strategyMs.toFixed(0)} ms</span>}
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-2 font-[ui-monospace,Menlo,monospace] text-xs leading-5 custom-scrollbar" aria-live="polite">
          {out.lookahead && (
            out.lookahead.leaks ? (
              <p className="flex items-start gap-1.5 text-rose-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Lookahead check failed: weights from {out.lookahead.firstDate} changed when later prices were removed. The strategy either reads future prices or is not deterministic (seed any randomness). Until that is fixed, its results are not valid.
              </p>
            ) : (
              out.lookahead.cutoffs.length === 0 ? (
                <p className="text-muted">The lookahead check did not run: the history is too short to cut off.</p>
              ) : (
                <p
                  className="flex items-start gap-1.5 text-emerald-400"
                  title={`A spot check, not proof. The strategy was rerun with history cut off at ${out.lookahead.cutoffs.join(" and ")}, and its weights did not change. It cannot rule out every way of reading future prices.`}
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  No lookahead detected at {out.lookahead.cutoffs.length} test cut-off{out.lookahead.cutoffs.length === 1 ? "" : "s"}.
                </p>
              )
            )
          )}
          {out.logs.map((line, i) => (
            <p key={i} className={cn("whitespace-pre-wrap break-words", line.startsWith("error: ") ? "text-rose-400" : line.startsWith("warning: ") ? "text-body" : "text-body-strong")}>
              {line}
            </p>
          ))}
          {out.error && (
            <p className="whitespace-pre-wrap break-words text-rose-400" role="alert">
              {out.error.line ? `${file}, line ${out.error.line}: ` : ""}{out.error.message}
            </p>
          )}
          {!out.lookahead && !out.error && out.logs.length === 0 && (
            <p className="text-muted">
              Output from print() / console.log() appears here.{" "}
              {language === "python" && !wide && "Python downloads about 14 MB the first time you run it."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
