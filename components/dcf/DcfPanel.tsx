"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { impliedGrowth, sensitivity, type DcfInputs } from "@/lib/valuation/dcf";
import { describeResult, type Described } from "@/lib/valuation/summarize";
import type { DcfResponse } from "@/lib/valuation/response";
import { Skeleton } from "@/components/ui/skeleton";

async function loadDcf(ticker: string): Promise<DcfResponse> {
  const res = await fetch(`/api/stock/dcf?ticker=${encodeURIComponent(ticker)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "The valuation is unavailable right now.");
  return data as DcfResponse;
}

type Edits = { wacc: string; gT: string; margin: string; ronic: string };
const NO_EDITS: Edits = { wacc: "", gT: "", margin: "", ronic: "" };

const pct = (x: number) => (x * 100).toFixed(2).replace(/\.?0+$/, "");

/** Percent text from a field to a decimal; null when empty or not a number. */
function fromField(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n / 100 : null;
}

function Field({
  id, label, value, placeholder, onChange, hint,
}: { id: string; label: string; value: string; placeholder: string; onChange: (v: string) => void; hint: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-muted">{label}</label>
      <div className="relative mt-1">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={0.25}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-lg bg-surface-soft px-3 pr-7 font-mono text-sm text-ink ring-1 ring-hairline focus-visible:outline-2 focus-visible:outline-compass"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">%</span>
      </div>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Answer({ described }: { described: Described }) {
  return (
    <div className="space-y-2">
      <p className="text-base font-medium leading-snug text-ink">{described.headline}</p>
      <p className="text-xs text-muted">{described.assumptions}</p>
      {described.terminalShare && <p className="text-xs text-body">{described.terminalShare}</p>}
      {described.band && <p className="text-xs text-body">{described.band}</p>}
    </div>
  );
}

export default function DcfPanel({ ticker }: { ticker: string }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ["dcf", ticker],
    queryFn: () => loadDcf(ticker),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const [edits, setEdits] = useState<Edits>(NO_EDITS);
  const edited = Object.values(edits).some((v) => v.trim() !== "");

  const recomputed = useMemo((): { described: Described } | { problem: string } | null => {
    if (!data || data.status !== "ok" || !edited) return null;
    const next: DcfInputs = { ...data.inputs };
    const wacc = fromField(edits.wacc);
    const gT = fromField(edits.gT);
    const margin = fromField(edits.margin);
    const ronic = fromField(edits.ronic);
    if (wacc !== null) next.wacc = wacc;
    if (gT !== null) next.gT = gT;
    if (margin !== null) {
      next.margin0 = margin;
      next.marginT = margin;
    }
    if (ronic !== null) next.ronic = ronic;
    try {
      const implied = impliedGrowth(next, data.price);
      return { described: describeResult({ implied, band: sensitivity(next, data.price) }, next) };
    } catch (e) {
      return { problem: e instanceof Error ? e.message : "These inputs cannot be used." };
    }
  }, [data, edits, edited]);

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading valuation" className="space-y-3 py-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (error || !data) {
    return <p role="alert" className="py-2 text-sm text-muted">{error instanceof Error ? error.message : "The valuation is unavailable right now."}</p>;
  }
  if (data.status === "refused") {
    return (
      <div className="space-y-2 py-2">
        <p className="text-sm font-medium text-ink">No valuation for {data.ticker}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-body">
          {data.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
        <p className="text-xs text-muted">The tool says nothing rather than show a number it cannot stand behind.</p>
      </div>
    );
  }

  const set = (key: keyof Edits) => (v: string) => setEdits((prev) => ({ ...prev, [key]: v }));
  const answer = recomputed && "described" in recomputed ? recomputed.described : data.headline;

  return (
    <div className="space-y-4 py-2">
      <div>
        <h3 className="text-sm font-medium text-ink">What the price asks for</h3>
        <p className="mt-1 text-xs text-muted">
          Works backward from {data.name ?? data.ticker} at ${data.price.toFixed(2)} to the revenue growth its filings would need to support that price.
        </p>
      </div>

      <Answer described={answer} />
      {recomputed && "problem" in recomputed && (
        <p role="alert" className="text-xs text-body">{recomputed.problem}</p>
      )}

      {data.impliedReturn && !edited && <p className="text-xs text-body">{data.impliedReturn}</p>}

      <section aria-label="Change an assumption" className="space-y-3 rounded-xl p-3 ring-1 ring-hairline">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-ink">Change an assumption</h4>
          {edited && (
            <button type="button" onClick={() => setEdits(NO_EDITS)} className="min-h-8 text-xs font-medium text-compass hover:underline">
              Back to the filing-based values
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id="dcf-wacc" label="Cost of capital" value={edits.wacc} placeholder={pct(data.inputs.wacc)} onChange={set("wacc")} hint="Between 3% and 20%." />
          <Field id="dcf-gt" label="Terminal growth" value={edits.gT} placeholder={pct(data.inputs.gT)} onChange={set("gT")} hint="Must sit 1 point below the cost of capital." />
          <Field id="dcf-margin" label="Operating margin" value={edits.margin} placeholder={pct(data.inputs.margin0)} onChange={set("margin")} hint="Held for every year." />
          <Field id="dcf-ronic" label="Return on new capital" value={edits.ronic} placeholder={pct(data.inputs.ronic)} onChange={set("ronic")} hint="What new investment earns." />
        </div>
      </section>

      {!edited && data.neutral.headline !== data.headline.headline && (
        <details className="text-xs text-body">
          <summary className="cursor-pointer text-muted">If new investment only earns the cost of capital</summary>
          <div className="mt-2"><Answer described={data.neutral} /></div>
        </details>
      )}

      <details className="text-xs text-body">
        <summary className="cursor-pointer text-muted">Every input and where it comes from</summary>
        <dl className="mt-2 space-y-2">
          {data.rows.map((row) => (
            <div key={row.label}>
              <dt className="flex justify-between gap-3 text-ink"><span>{row.label}</span><span className="font-mono">{row.value}</span></dt>
              <dd className="text-muted">{row.note}</dd>
            </div>
          ))}
        </dl>
      </details>

      {data.warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
          {data.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}

      <p className="text-xs text-muted">
        A calculation from SEC filings and the inputs shown, for study. It says what this price implies under these assumptions. It is not investment advice and not a forecast. Filing year ending {data.fiscalYearEnd}.
      </p>
    </div>
  );
}
