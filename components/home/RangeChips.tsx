"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RangeChipsProps<T extends string> {
  ranges: readonly T[];
  value: T;
  onChange: (r: T) => void;
  label?: string;
  className?: string;
}

export default function RangeChips<T extends string>({
  ranges,
  value,
  onChange,
  label = "Chart range",
  className,
}: RangeChipsProps<T>) {
  const pillId = useId();
  return (
    <div role="group" aria-label={label} className={cn("flex items-center gap-1", className)}>
      {ranges.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={value === r}
          onClick={() => onChange(r)}
          className={cn(
            "relative rounded-lg px-2 py-1 min-h-8 text-xs font-medium transition-colors duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass",
            value === r ? "text-ink" : "text-muted hover:text-ink",
          )}
        >
          {value === r && (
            <motion.span
              layoutId={`range-pill-${pillId}`}
              className="absolute inset-0 rounded-lg bg-surface-soft"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
          <span className="relative">{r}</span>
        </button>
      ))}
    </div>
  );
}
