"use client";

import { useLayoutEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { EASE } from "../motion/Reveal";

/**
 * Renders a number and tweens it to each new value (no animation on first
 * paint, so an always-visible price never flashes zero).
 */
export default function PriceTween({
  value,
  format,
  duration = 0.6,
  className,
}: {
  value: number;
  format: (v: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const shown = useRef(value);
  const fmt = useRef(format);

  useLayoutEffect(() => {
    fmt.current = format;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduce || shown.current === value || !Number.isFinite(value)) {
      shown.current = value;
      return;
    }
    const controls = animate(shown.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = fmt.current(v);
      },
      onComplete: () => {
        shown.current = value;
        el.textContent = fmt.current(value);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
