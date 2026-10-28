"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Plus that rotates into a check when the asset joins the portfolio, with a
 * 150ms scale pulse and a quick green ring flash on add. The parent button
 * must be `relative`.
 */
export default function HoldingIcon({
  inPortfolio,
  className,
}: {
  inPortfolio: boolean;
  className?: string;
}) {
  const [prev, setPrev] = useState(inPortfolio);
  const [pulse, setPulse] = useState(0);
  if (prev !== inPortfolio) {
    setPrev(inPortfolio);
    setPulse((p) => p + 1);
  }
  const Icon = inPortfolio ? Check : Plus;
  return (
    <>
      {pulse > 0 && inPortfolio && (
        <motion.span
          key={pulse}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-emerald-400"
          initial={{ opacity: 0.9, scale: 1 }}
          animate={{ opacity: 0, scale: 1.35 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={inPortfolio ? "in" : "out"}
          className="flex items-center justify-center"
          initial={{ rotate: inPortfolio ? 90 : -90, opacity: 0, scale: 1 }}
          animate={{ rotate: 0, opacity: 1, scale: [1, 1.2, 1] }}
          exit={{ rotate: inPortfolio ? -90 : 90, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <Icon className={cn(className)} aria-hidden="true" />
        </motion.span>
      </AnimatePresence>
    </>
  );
}
