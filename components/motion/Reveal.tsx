"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

/** Wealthsimple-style ease: fast out, long settle. */
export const EASE = [0.16, 1, 0.3, 1] as const;

interface RevealProps extends Omit<HTMLMotionProps<"div">, "initial" | "animate" | "whileInView" | "transition"> {
  /** Seconds to wait before the reveal starts. */
  delay?: number;
  /** Starting vertical offset in px. */
  y?: number;
  /** Seconds. */
  duration?: number;
  /** Animate on mount instead of when scrolled into view. */
  onMount?: boolean;
}

/**
 * Fades and lifts its children in once. Reduced-motion users get an instant
 * state because Providers wraps the app in MotionConfig reducedMotion="user".
 */
export default function Reveal({ delay = 0, y = 24, duration = 0.8, onMount = false, children, ...rest }: RevealProps) {
  const visible = { opacity: 1, y: 0 };
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      {...(onMount ? { animate: visible } : { whileInView: visible, viewport: { once: true, margin: "0px 0px -80px 0px" } })}
      transition={{ duration, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Parent that staggers `RevealItem` children as it scrolls into view. */
export function RevealGroup({
  stagger = 0.08,
  delay = 0,
  onMount = false,
  children,
  ...rest
}: Omit<HTMLMotionProps<"div">, "initial" | "animate" | "whileInView" | "variants"> & {
  stagger?: number;
  delay?: number;
  onMount?: boolean;
}) {
  const variants = { hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } };
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      {...(onMount ? { animate: "show" } : { whileInView: "show", viewport: { once: true, margin: "0px 0px -80px 0px" } })}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ y = 20, duration = 0.7, children, ...rest }: Omit<HTMLMotionProps<"div">, "variants"> & { y?: number; duration?: number }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration, ease: EASE } } }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
