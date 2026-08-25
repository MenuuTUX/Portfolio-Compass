"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGlossaryEntry } from "@/lib/glossary";

interface HelpTipProps {
  /** Glossary key / metric label, e.g. "PE Ratio" */
  term: string;
  /** Optional custom trigger content; defaults to the term label */
  children?: React.ReactNode;
  className?: string;
  /** Show a small info icon next to the label */
  showIcon?: boolean;
  /** underline style for discoverability */
  underline?: boolean;
}

/**
 * Beginner-friendly hover/focus tooltip for technical terms.
 * Renders via portal so drawer overflow doesn't clip the tip.
 */
export function HelpTip({
  term,
  children,
  className,
  showIcon = true,
  underline = true,
}: HelpTipProps) {
  const entry = getGlossaryEntry(term);
  const tipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placeAbove: boolean;
  } | null>(null);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tipWidth = 280;
    const pad = 12;
    let left = rect.left + rect.width / 2 - tipWidth / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tipWidth - pad));
    // Prefer below; flip above if near bottom of viewport
    const below = rect.bottom + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < 140;
    const top = placeAbove ? rect.top - 8 : below;
    setCoords({
      top,
      left,
      placeAbove,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, updatePosition]);

  // Unknown terms render as plain text.
  if (!entry) {
    return <span className={className}>{children ?? term}</span>;
  }

  const show = () => {
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <>
      <span
        ref={triggerRef}
        className={cn(
          "inline-flex items-center gap-1 max-w-full cursor-help",
          className,
        )}
        tabIndex={0}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <span
          className={cn(
            "truncate",
            underline &&
              "border-b border-dotted border-neutral-500/60 group-hover:border-neutral-400",
          )}
        >
          {children ?? entry.label}
        </span>
        {showIcon && (
          <Info
            className="w-3 h-3 shrink-0 text-neutral-500 opacity-60 hover:opacity-100 transition-opacity"
            aria-hidden
          />
        )}
      </span>

      {open &&
        coords &&
        createPortal(
          <div
            id={tipId}
            role="tooltip"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: 280,
              zIndex: 9999,
              transform: coords.placeAbove ? "translateY(-100%)" : undefined,
            }}
            className="pointer-events-none rounded-xl border border-hairline bg-stone-950/95 backdrop-blur-md shadow-2xl p-3.5"
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <div className="text-xs font-bold text-ink tracking-wide mb-1.5">
              {entry.label}
            </div>
            <p className="text-[11px] text-neutral-300 leading-relaxed mb-2">
              {entry.what}
            </p>
            <p className="text-[11px] text-emerald-400/90 leading-relaxed border-t border-hairline pt-2">
              <span className="font-semibold text-emerald-400">
                What it means:{" "}
              </span>
              {entry.means}
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Section title with optional tip when the title itself is technical */
export function HelpLabel({
  term,
  className,
}: {
  term: string;
  className?: string;
}) {
  return (
    <HelpTip term={term} className={className} showIcon underline>
      {term}
    </HelpTip>
  );
}
