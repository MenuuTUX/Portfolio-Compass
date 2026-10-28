"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Skeleton block with a slow horizontal shimmer sweep (1.6s). Static for
 * reduced-motion users.
 */
export default function Shimmer({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className={cn("rounded bg-surface-soft", className)}
      style={{
        backgroundImage:
          "linear-gradient(90deg, transparent 0%, rgba(128,128,128,0.16) 50%, transparent 100%)",
        backgroundSize: "60% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "-100% 0",
      }}
      animate={reduce ? undefined : { backgroundPosition: ["-100% 0", "200% 0"] }}
      transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
    />
  );
}
