"use client";

import { applyLesson, isGuided, type LabForm } from "@/lib/lab/lab-form";
import { LESSONS, lessonById } from "@/lib/lab/lessons";
import { cn } from "@/lib/utils";

type Mode = "guided" | "no-code" | "code";

/** Guided lessons, form-based rules, or free code. Guided and Code share the editor; Code drops the lesson. */
export default function ModeSwitch({ form, onChange }: { form: LabForm; onChange: (next: LabForm) => void }) {
  const current: Mode = isGuided(form) ? "guided" : form.mode;
  const choose = (mode: Mode) => {
    if (mode === current) return;
    if (mode === "guided") {
      // Back to the lesson the user left, or the first one; their code is replaced by the lesson's.
      onChange(applyLesson(form, lessonById(form.lessonId) ?? LESSONS[0]));
    } else if (mode === "code") {
      onChange({ ...form, mode: "code", lessonId: null });
    } else {
      onChange({ ...form, mode: "no-code" });
    }
  };
  return (
    <div role="radiogroup" aria-label="How to build the strategy" className="grid grid-cols-3 gap-1 rounded-lg bg-surface-soft p-1">
      {([["guided", "Guided"], ["no-code", "No-code"], ["code", "Code"]] as const).map(([k, text]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={current === k}
          onClick={() => choose(k)}
          className={cn(
            "h-8 rounded-md text-xs font-semibold transition-colors duration-75",
            current === k ? "bg-[var(--panel)] text-ink ring-1 ring-hairline" : "text-muted hover:text-ink",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
