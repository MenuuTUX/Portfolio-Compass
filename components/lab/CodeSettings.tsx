"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FolderOpen, Save, Trash2, Upload } from "lucide-react";
import type { LabForm } from "@/lib/lab/lab-form";
import {
  deleteStrategy,
  exportFileName,
  listStrategies,
  newStrategyId,
  parseStrategyFile,
  saveStrategy,
  type SavedStrategy,
} from "@/lib/lab/strategies";
import { CODE_TEMPLATES } from "@/lib/lab/strategy/templates";
import type { ParamValue, Params, StrategyError, StrategyLanguage } from "@/lib/lab/strategy/types";
import { cn } from "@/lib/utils";

const field =
  "h-9 w-full rounded-md bg-surface-soft px-2.5 text-sm text-ink ring-1 ring-hairline focus-visible:outline-2 focus-visible:outline-compass";
const label = "block text-xs font-medium text-muted mb-1";

const MAX_IMPORT_BYTES = 200_000;

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-hairline px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The other language's version of a built-in template, if `code` is one. */
function counterpart(code: string, to: StrategyLanguage): string | null {
  const t = CODE_TEMPLATES.find((x) => x.python === code || x.typescript === code);
  return t ? t[to] : null;
}

interface CodeSettingsProps {
  form: LabForm;
  onChange: (next: LabForm) => void;
  /** Defaults read from the code; null until read or while the code has an error. */
  params: Params | null;
  paramsError: StrategyError | null;
}

export default function CodeSettings({ form, onChange, params, paramsError }: CodeSettingsProps) {
  const [saved, setSaved] = useState<SavedStrategy[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => listStrategies().then(setSaved).catch(() => setSaved([]));
  useEffect(() => {
    void refresh();
  }, []);

  const universe = form.universe.map((t) => t.trim().toUpperCase()).filter(Boolean);

  const switchLanguage = (to: StrategyLanguage) => {
    if (to === form.language) return;
    const same = counterpart(form.code, to);
    if (same) return onChange({ ...form, language: to, code: same, paramOverrides: {} });
    const starter = CODE_TEMPLATES[0][to];
    if (!confirm(`Your code is ${form.language === "python" ? "Python" : "TypeScript"}. Replace it with a ${to === "python" ? "Python" : "TypeScript"} starter?`)) return;
    onChange({ ...form, language: to, code: starter, paramOverrides: {}, strategyId: null });
  };

  const save = async (asNew: boolean) => {
    const id = !asNew && form.strategyId ? form.strategyId : newStrategyId();
    const name = form.name.trim() || "Untitled strategy";
    try {
      await saveStrategy({ id, name, language: form.language, code: form.code, universe, params: form.paramOverrides, updatedAt: new Date().toISOString() });
      onChange({ ...form, strategyId: id, name });
      setNote(`Saved "${name}" in this browser.`);
      void refresh();
    } catch {
      setNote("Could not save: this browser's storage is unavailable or full.");
    }
  };

  const open = (id: string) => {
    const s = saved.find((x) => x.id === id);
    if (!s) return;
    onChange({
      ...form,
      name: s.name,
      language: s.language,
      code: s.code,
      paramOverrides: s.params,
      strategyId: s.id,
      universe: s.universe.length ? s.universe : form.universe,
    });
    setNote(null);
  };

  const remove = async () => {
    const s = saved.find((x) => x.id === form.strategyId);
    if (!s || !confirm(`Delete "${s.name}" from this browser?`)) return;
    await deleteStrategy(s.id).catch(() => undefined);
    onChange({ ...form, strategyId: null });
    void refresh();
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseStrategyFile(file.name);
    if (!parsed) return setNote("Choose a .py or .ts file.");
    if (file.size > MAX_IMPORT_BYTES) return setNote("That file is larger than 200 KB, which is too big for a strategy.");
    onChange({ ...form, name: parsed.name, language: parsed.language, code: await file.text(), paramOverrides: {}, strategyId: null });
    setNote(`Imported ${file.name}. Set the universe below, then run.`);
  };

  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([form.code], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(form.name, form.language);
    a.click();
    URL.revokeObjectURL(url);
  };

  const setParam = (key: string, value: ParamValue) => onChange({ ...form, paramOverrides: { ...form.paramOverrides, [key]: value } });
  const paramEntries = Object.entries(params ?? {});
  const edited = Object.keys(form.paramOverrides).length > 0;

  return (
    <>
      <Section title="Code">
        <div role="radiogroup" aria-label="Language" className="grid grid-cols-2 gap-1 rounded-lg bg-surface-soft p-1">
          {([["python", "Python"], ["typescript", "TypeScript"]] as const).map(([k, text]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={form.language === k}
              onClick={() => switchLanguage(k)}
              className={cn(
                "h-8 rounded-md text-xs font-semibold transition-colors duration-75",
                form.language === k ? "bg-[var(--panel)] text-ink ring-1 ring-hairline" : "text-muted hover:text-ink",
              )}
            >
              {text}
            </button>
          ))}
        </div>
        <p className="text-xs text-body">
          Write <code className="font-mono">weights(prices, ctx)</code>: adjusted closes in, target weights out. The engine fills at the next bar and handles costs, cash and dividends.
          {form.language === "python" && " Runs numpy and pandas in your browser."}
        </p>
        <div className="flex flex-wrap gap-2">
          {CODE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="ws-chip"
              title={t.description}
              onClick={() =>
                onChange({
                  ...form,
                  name: t.label,
                  code: t[form.language],
                  universe: t.universe,
                  rebalance: t.id === "crossover" ? "on-change" : "M",
                  paramOverrides: {},
                  strategyId: null,
                })
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Saved in this browser">
        {saved.length > 0 && (
          <div>
            <label htmlFor="lab-saved" className={label}>Open</label>
            <select id="lab-saved" className={field} value={form.strategyId ?? ""} onChange={(e) => open(e.target.value)}>
              <option value="" disabled>{form.strategyId ? "" : "Choose a saved strategy"}</option>
              {saved.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.language === "python" ? "py" : "ts"})</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ws-pill" onClick={() => void save(false)}>
            <Save className="h-3.5 w-3.5" aria-hidden /> {form.strategyId ? "Save" : "Save as new"}
          </button>
          {form.strategyId && (
            <>
              <button type="button" className="ws-pill" onClick={() => void save(true)}>
                <FolderOpen className="h-3.5 w-3.5" aria-hidden /> Save copy
              </button>
              <button type="button" className="ws-pill" onClick={() => void remove()} aria-label={`Delete ${form.name}`}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
              </button>
            </>
          )}
          <button type="button" className="ws-pill" onClick={() => fileInput.current?.click()}>
            <Upload className="h-3.5 w-3.5" aria-hidden /> Import
          </button>
          <button type="button" className="ws-pill" onClick={exportFile}>
            <Download className="h-3.5 w-3.5" aria-hidden /> Export .{form.language === "python" ? "py" : "ts"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".py,.ts"
            className="hidden"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {note && <p className="text-xs text-body" role="status">{note}</p>}
      </Section>

      <Section
        title="Params"
        aside={edited && (
          <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => onChange({ ...form, paramOverrides: {} })}>
            Reset to code
          </button>
        )}
      >
        {paramsError ? (
          <p className="text-xs text-rose-400">Fix the code to edit params{paramsError.line ? ` (line ${paramsError.line})` : ""}.</p>
        ) : params === null ? (
          <p className="text-xs text-muted">Reading params from your code…</p>
        ) : paramEntries.length === 0 ? (
          <p className="text-xs text-muted">
            Export <code className="font-mono">{form.language === "python" ? "PARAMS = {...}" : "params = {...}"}</code> to edit values here without touching the code.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {paramEntries.map(([key, def]) => {
              const value = form.paramOverrides[key] ?? def;
              const id = `lab-param-${key}`;
              if (typeof def === "boolean") {
                return (
                  <label key={key} className="col-span-2 flex items-center gap-2 text-sm text-body">
                    <input type="checkbox" checked={Boolean(value)} onChange={(e) => setParam(key, e.target.checked)} />
                    <span className="font-mono">{key}</span>
                  </label>
                );
              }
              return (
                <div key={key}>
                  <label htmlFor={id} className={cn(label, "font-mono")}>{key}</label>
                  <input
                    id={id}
                    className={cn(field, "font-mono", value !== def && "ring-compass")}
                    inputMode={typeof def === "number" ? "decimal" : undefined}
                    value={String(value)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const n = Number(raw);
                      setParam(key, typeof def === "number" && raw.trim() !== "" && Number.isFinite(n) ? n : raw);
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
